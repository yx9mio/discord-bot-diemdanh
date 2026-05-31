// commands/quanly.js — /quanly: Mở bảng quản lý bot (Admin)
'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../db.js');
const { buildDashboard } = require('../handlers/setupUiHandler.js');
const { requireAdmin } = require('../utils/permissions.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quanly')
    .setDescription('Mở bảng quản lý bot (chỉ Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const { ok, cfg } = await requireAdmin(interaction, { context: '/quanly' });
    if (!ok) return;

    await interaction.deferReply({ ephemeral: true });
    const payload = await buildDashboard(interaction.guild, cfg);
    return interaction.editReply(payload);
  },
};
