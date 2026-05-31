// commands/setup.js — Entry point: /setup mở Dashboard UI
const {
  SlashCommandBuilder, PermissionFlagsBits,
} = require('discord.js');
const db = require('../db.js');
const { buildDashboard } = require('../handlers/setupUiHandler.js');

const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Mở dashboard cấu hình bot (role, phái, lịch)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function execute(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '🔒 Chỉ **Quản trị viên** mới dùng được `/setup`.', ephemeral: true });
  }
  await interaction.deferReply({ ephemeral: true });
  const cfg = await db.getConfig(interaction.guild.id);
  const payload = await buildDashboard(interaction.guild, cfg);
  return interaction.editReply(payload);
}

module.exports = { data, execute };
