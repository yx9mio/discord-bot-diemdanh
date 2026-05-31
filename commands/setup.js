// commands/setup.js — Entry point: /setup mở Dashboard UI
'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../db.js');
const { buildDashboard } = require('../handlers/setupUiHandler.js');
const { requireAdmin } = require('../utils/permissions.js');

const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Mở dashboard cấu hình bot (role, phái, lịch)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function execute(interaction) {
  const { ok } = await requireAdmin(interaction, { cfgRequired: false, context: '/setup' });
  if (!ok) return;

  await interaction.deferReply({ ephemeral: true });
  const cfg = await db.getConfig(interaction.guild.id);
  const payload = await buildDashboard(interaction.guild, cfg);
  return interaction.editReply(payload);
}

module.exports = { data, execute };
