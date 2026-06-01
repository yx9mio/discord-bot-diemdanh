// src/commands/diemdanh.js
'use strict';
const { Command } = require('@sapphire/framework');
const { MessageFlags } = require('discord.js');
const db = require('../../db.js');
const { buildSessionEmbed, replyErr } = require('../../utils/embeds.js');

class DiemDanhCommand extends Command {
  constructor(context) {
    super(context, { name: 'diemdanh', description: 'Điểm danh tham gia phiên' });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(builder =>
      builder
        .setName('diemdanh')
        .setDescription('Điểm danh tham gia phiên')
        .addStringOption(o =>
          o.setName('trang_thai').setDescription('Trạng thái').setRequired(false)
            .addChoices(
              { name: '✅ Tham gia',   value: 'tham_gia' },
              { name: '⏰ Đến trễ',   value: 'tre' },
              { name: '❌ Vắng',      value: 'khong_tham_gia' },
            )
        )
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { guild, user } = interaction;
    const status = interaction.options.getString('trang_thai') ?? 'tham_gia';

    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply(replyErr('Không có phiên nào đang mở.'));

    const eligible = session.eligible_member_ids;
    if (eligible?.length && !eligible.includes(user.id))
      return interaction.editReply(replyErr('Bạn không thuộc danh sách điểm danh của phiên này.'));

    await db.upsertAttendance({ session_id: session.id, user_id: user.id, status });
    const attended = await db.getAttendances(session.id);
    const cfg      = await db.getGuildConfig(guild.id);
    const embed    = await buildSessionEmbed(guild, session, attended, cfg.phai_role_ids ?? []);

    if (session.message_id) {
      const ch = guild.channels.cache.get(session.channel_id);
      if (ch) {
        const msg = await ch.messages.fetch(session.message_id).catch(() => null);
        if (msg) await msg.edit({ embeds: [embed] }).catch(() => null);
      }
    }

    const label = { tham_gia: '✅ Tham gia', tre: '⏰ Trễ', khong_tham_gia: '❌ Vắng' };
    await interaction.editReply({ content: `${label[status] ?? '✅'} Đã ghi nhận điểm danh của bạn.` });
  }
}

module.exports = { DiemDanhCommand };
