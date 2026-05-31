// commands/huy.js
'use strict';
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { voHieuHoaNutDiemDanh } = require('../utils/session.js');
const { xoaHenGio } = require('../utils/timers.js');
const { laAdmin } = require('../utils/helpers.js');
const { replyOkEdit, replyErrEdit, replyWarnEdit } = require('../utils/embeds.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('huy_diemdanh')
    .setDescription('Hủy phiên điểm danh đang mở (không lưu kết quả)')
    .setDefaultMemberPermissions(0n),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild, member, channel } = interaction;

    const cfg = await db.getConfig(guild.id);
    if (!laAdmin(member, cfg)) {
      return interaction.editReply(replyErrEdit('🔒 Bạn không có quyền dùng lệnh này.'));
    }

    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply(replyWarnEdit('📭 Không có phiên nào đang mở.'));

    xoaHenGio(guild.id);
    await db.cancelSession(session.id);
    await voHieuHoaNutDiemDanh(interaction.client, channel, session);

    return interaction.editReply(replyOkEdit('Đã hủy phiên điểm danh.'));
  },
};
