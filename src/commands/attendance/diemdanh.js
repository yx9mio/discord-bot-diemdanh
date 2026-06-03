// src/commands/attendance/diemdanh.js
// [A4] Refactor để dùng attendanceService.markAttendance()
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder } = require('discord.js');
const db = require('../../../db.js');
const { replyErr } = require('../../../utils/embeds.js');
const { markAttendance } = require('../../../utils/attendanceService.js');

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
             { name: '❌ Vắng',      value: 'khong_tham_gia' },
             { name: '🏥 Có phép',  value: 'co_phep' },
           )
        )
    );
  }

  async chatInputRun(interaction) {
    const { guild, member, user } = interaction;
    const status = interaction.options.getString('trang_thai') ?? 'tham_gia';

    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.reply({ ...replyErr('Không có phiên nào đang mở.'), ephemeral: true });

    // [A4] Dùng shared service logic - đồng bộ với SelectMenu flow
    return markAttendance({ guild, member, user, status, interaction, session, deferred: false });
  }
}

module.exports = { DiemDanhCommand };
