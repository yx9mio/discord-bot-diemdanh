// commands/quanly.js — /quanly: Mở bảng quản lý bot (Admin)
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildDashboard } = require('../handlers/setupUiHandler.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quanly')
    .setDescription('Mở bảng quản lý bot (chỉ Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    return buildDashboard(interaction);
  },
};
