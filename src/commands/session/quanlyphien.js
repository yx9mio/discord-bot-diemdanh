// src/commands/session/quanlyphien.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../db.js');

const DAY_NAMES    = ['CN','T2','T3','T4','T5','T6','T7'];
const STATUS_EMOJI = { tham_gia: '✅', khong_tham_gia: '❌', tre: '⏰', co_phep: '🟡' };

function fmtTs(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${DAY_NAMES[d.getDay()]} ${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit' })}`;
}
function durationStr(startedAt, endedAt) {
  const ms = new Date(endedAt ?? Date.now()) - new Date(startedAt);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function buildActiveEmbed(session, attendances) {
  const present  = attendances.filter(a => a.status === 'tham_gia').length;
  const late     = attendances.filter(a => a.status === 'tre').length;
  const eligible = (session.eligible_member_ids ?? []).length;
  return new EmbedBuilder().setColor(0x01696f).setTitle(`🟢 Phiên đang chạy — ${session.session_name}`)
    .addFields(
      { name: '🆔 ID',         value: `\`${session.id}\``,                          inline: true },
      { name: '⏱️ Bắt đầu',   value: fmtTs(session.started_at ?? session.created_at), inline: true },
      { name: '⏳ Đang chạy', value: durationStr(session.started_at ?? session.created_at, null), inline: true },
      { name: '✅ Có mặt',    value: `${present}`,   inline: true },
      { name: '⏰ Trễ',        value: `${late}`,      inline: true },
      { name: '👥 Bắt buộc',  value: eligible ? `${eligible}` : 'Tất cả', inline: true },
    ).setTimestamp();
}
function buildHistoryEmbed(sessions) {
  const lines = sessions.map((s, i) => {
    const icon = s.cancelled ? '🚫' : '✅';
    return `${icon} **${i + 1}.** ${s.session_name} — ${fmtTs(s.ended_at ?? s.created_at)}`;
  });
  return new EmbedBuilder().setColor(0x006494).setTitle('📚 Lịch sử phiên')
    .setDescription(lines.join('\n') || '_Chưa có phiên nào_').setTimestamp();
}

class QuanLyPhienCommand extends Command {
  constructor(context) {
    super(context, { name: 'quanlyphien', description: 'Quản lý phiên điểm danh', preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('quanlyphien')
        .setDescription('Quản lý phiên điểm danh')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(s => s.setName('hien_tai').setDescription('Xem phiên đang chạy'))
        .addSubcommand(s => s.setName('lich_su').setDescription('Xem lịch sử phiên')
          .addIntegerOption(o => o.setName('so_luong').setDescription('Số phiên (mặc định 10)').setMinValue(1).setMaxValue(25)))
        .addSubcommand(s => s.setName('diem_danh_vang').setDescription('Đánh dấu thành viên vắng mặt thủ công'))
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const { guild } = interaction;

    if (sub === 'hien_tai') {
      const session = await db.getActiveSession(guild.id);
      if (!session) return interaction.editReply({ content: '📭 Không có phiên nào đang mở.' });
      const attendances = await db.getAttendances(session.id);
      return interaction.editReply({ embeds: [buildActiveEmbed(session, attendances)] });
    }

    if (sub === 'lich_su') {
      const limit = interaction.options.getInteger('so_luong') ?? 10;
      const sessions = await db.getSessionHistory(guild.id, { limit, offset: 0 });
      return interaction.editReply({ embeds: [buildHistoryEmbed(sessions)] });
    }

    if (sub === 'diem_danh_vang') {
      const session = await db.getActiveSession(guild.id);
      if (!session) return interaction.editReply({ content: '⚠️ Không có phiên nào đang mở.' });

      const attendances = await db.getAttendances(session.id);
      const presentIds  = new Set(attendances.map(a => a.user_id));
      await guild.members.fetch();

      const eligible = session.eligible_member_ids?.length ? session.eligible_member_ids : null;
      const absent = guild.members.cache
        .filter(m => !m.user.bot && !presentIds.has(m.id) && (!eligible || eligible.includes(m.id)))
        .first(25);

      if (!absent.size) return interaction.editReply({ content: '✅ Tất cả đã điểm danh!' });

      const options = [...absent.values()].map(m => ({
        label: m.displayName.slice(0, 100),
        value: m.id,
      }));

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('quanly_mark_absent')
          .setPlaceholder('Chọn thành viên để đánh dấu vắng')
          .setMinValues(1).setMaxValues(options.length)
          .addOptions(options)
      );

      const reply = await interaction.editReply({ content: 'Chọn thành viên cần đánh dấu vắng mặt:', components: [row] });
      const collector = reply.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 30_000 });
      collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) return i.reply({ content: '⛔ Không phải lệnh của bạn.', ephemeral: true });
        for (const uid of i.values) {
          await db.upsertAttendance({ sessionId: session.id, userId: uid, status: 'khong_tham_gia' });
        }
        await i.update({ content: `✅ Đã đánh dấu ${i.values.length} thành viên vắng mặt.`, components: [] });
        collector.stop();
      });
      collector.on('end', (_, reason) => {
        if (reason === 'time') interaction.editReply({ content: '⏰ Hết thời gian.', components: [] }).catch(() => null);
      });
    }
  }
}

module.exports = { QuanLyPhienCommand };
