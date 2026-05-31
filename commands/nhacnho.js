// commands/nhacnho.js
'use strict';
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { laAdmin } = require('../utils/helpers.js');
const { datHenGioNhacNho } = require('../utils/timers.js');
const { replyOkEdit, replyErrEdit, replyWarnEdit } = require('../utils/embeds.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nhac_nho')
    .setDescription('[Admin] Đặt hẹn giờ nhắc nhở điểm danh')
    .setDefaultMemberPermissions(0n)
    .addIntegerOption(o =>
      o.setName('phut').setDescription('Nhắc sau bao nhiêu phút').setRequired(true).setMinValue(1)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild, member } = interaction;
    const cfg = await db.getConfig(guild.id);
    if (!laAdmin(member, cfg)) {
      return interaction.editReply(replyErrEdit('🔒 Bạn không có quyền dùng lệnh này.'));
    }

    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply(replyWarnEdit('📭 Không có phiên nào đang mở.'));

    const phut = interaction.options.getInteger('phut');
    datHenGioNhacNho(interaction.client, guild.id, session.id, phut);

    return interaction.editReply(replyOkEdit(`Đã đặt nhắc nhở sau **${phut} phút**.`));
  },
};
