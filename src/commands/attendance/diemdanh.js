// src/commands/attendance/diemdanh.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../db.js');

const STATUS_LABEL = { tham_gia: '✅ Tham gia', tre: '⏰ Trễ', co_phep: '🟡 Có phép', khong_tham_gia: '❌ Vắng' };

class DiemDanhCommand extends Command {
  constructor(context) {
    super(context, { name: 'diemdanh', description: 'Điểm danh tham gia phiên hiện tại' });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('diemdanh')
        .setDescription('Điểm danh tham gia phiên hiện tại')
        .addStringOption(o =>
          o.setName('trang_thai').setDescription('Trạng thái điểm danh').setRequired(false)
           .addChoices(
             { name: '✅ Tham gia',  value: 'tham_gia' },
             { name: '⏰ Trễ',       value: 'tre' },
             { name: '🟡 Có phép',  value: 'co_phep' },
           )
        )
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild, user } = interaction;
    const status = interaction.options.getString('trang_thai') ?? 'tham_gia';

    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply({ content: '⚠️ Không có phiên nào đang mở.' });

    const eligible = session.eligible_member_ids;
    if (eligible?.length && !eligible.includes(user.id)) {
      return interaction.editReply({ content: '⛔ Bạn không thuộc danh sách điểm danh của phiên này.' });
    }

    await db.upsertAttendance({ sessionId: session.id, userId: user.id, status });

    const embed = new EmbedBuilder()
      .setColor(status === 'tham_gia' ? 0x437a22 : status === 'tre' ? 0xda7101 : 0xd19900)
      .setTitle(`${STATUS_LABEL[status]} — Đã điểm danh`)
      .setDescription(`<@${user.id}> — Phiên: **${session.session_name}**`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

module.exports = { DiemDanhCommand };
