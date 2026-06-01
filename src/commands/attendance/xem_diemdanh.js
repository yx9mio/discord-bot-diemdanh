// src/commands/attendance/xem_diemdanh.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../db.js');

const STATUS_EMOJI = { tham_gia: '✅', khong_tham_gia: '❌', tre: '⏰', co_phep: '🟡' };

class XemDiemDanhCommand extends Command {
  constructor(context) {
    super(context, { name: 'xem_diemdanh', description: 'Xem danh sách điểm danh của phiên hiện tại' });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('xem_diemdanh')
        .setDescription('Xem danh sách điểm danh của phiên hiện tại')
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply({ content: '⚠️ Không có phiên nào đang mở.' });

    const attendances = await db.getAttendances(session.id);
    if (!attendances.length) return interaction.editReply({ content: '📭 Chưa có ai điểm danh.' });

    const lines = attendances.map(a => `${STATUS_EMOJI[a.status] ?? '❓'} <@${a.user_id}>`);
    const embed = new EmbedBuilder()
      .setColor(0x01696f)
      .setTitle(`📋 Điểm danh — ${session.session_name}`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: `${attendances.length} người đã điểm danh` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

module.exports = { XemDiemDanhCommand };
