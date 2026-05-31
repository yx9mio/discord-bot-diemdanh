// commands/nhacnho.js
'use strict';
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { datHenGioTuDong } = require('../utils/timers.js');
const { replyOkEdit, replyWarnEdit } = require('../utils/embeds.js');
const { requireAdmin } = require('../utils/permissions.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nhac_nho')
    .setDescription('Đặt nhắc nhở tự động đóng phiên sau X phút')
    .addIntegerOption(o =>
      o.setName('phut').setDescription('Số phút còn lại').setRequired(true).setMinValue(1)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild, channel } = interaction;

    const { ok } = await requireAdmin(interaction, { context: '/nhac_nho' });
    if (!ok) return;

    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply(replyWarnEdit('📭 Không có phiên nào đang mở.'));

    const phut = interaction.options.getInteger('phut');
    datHenGioTuDong(guild.id, session.id, phut, interaction.client, channel);

    return interaction.editReply(replyOkEdit(`Đã đặt nhắc nhở sau **${phut} phút**.`));
  },
};
