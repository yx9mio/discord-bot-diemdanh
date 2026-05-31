// commands/quanly.js — /quanly: Mở bảng quản lý bot (Admin)
'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../db.js');
const { buildDashboard } = require('../handlers/setupUiHandler.js');
const { replyErr } = require('../utils/embeds.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quanly')
    .setDescription('Mở bảng quản lý bot (chỉ Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply(replyErr('❌ Lệnh này chỉ dùng được trong server.'));
    }
    await interaction.deferReply({ ephemeral: true });
    const cfg = await db.getConfig(interaction.guild.id);
    const payload = await buildDashboard(interaction.guild, cfg);
    return interaction.editReply(payload);
  },
};
