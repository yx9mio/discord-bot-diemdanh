// src/commands/session/status.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../db.js');

const DAY_NAMES   = ['CN','T2','T3','T4','T5','T6','T7'];
const STATUS_EMOJI = { tham_gia: '✅', khong_tham_gia: '❌', tre: '⏰', co_phep: '🟡' };

function fmtTs(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${DAY_NAMES[d.getDay()]} ${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit' })}`;
}
function durationStr(start) {
  const ms = Date.now() - new Date(start);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

class StatusCommand extends Command {
  constructor(context) {
    super(context, { name: 'status', description: 'Xem trạng thái phiên đang chạy' });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder().setName('status').setDescription('Xem trạng thái phiên điểm danh hiện tại')
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply({ content: '📭 Không có phiên nào đang mở.' });

    const attendances = await db.getAttendances(session.id);
    const present  = attendances.filter(a => a.status === 'tham_gia').length;
    const late     = attendances.filter(a => a.status === 'tre').length;
    const eligible = (session.eligible_member_ids ?? []).length;

    const embed = new EmbedBuilder()
      .setColor(0x01696f)
      .setTitle(`🟢 Phiên đang chạy — ${session.session_name}`)
      .addFields(
        { name: '🆔 ID',         value: `\`${session.id}\``,                          inline: true },
        { name: '⏱️ Bắt đầu',   value: fmtTs(session.started_at ?? session.created_at), inline: true },
        { name: '⏳ Đang chạy', value: durationStr(session.started_at ?? session.created_at), inline: true },
        { name: '✅ Có mặt',    value: `${present}`,                                   inline: true },
        { name: '⏰ Trễ',        value: `${late}`,                                      inline: true },
        { name: '👥 Bắt buộc',  value: eligible ? `${eligible}` : 'Tất cả',            inline: true },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

module.exports = { StatusCommand };
