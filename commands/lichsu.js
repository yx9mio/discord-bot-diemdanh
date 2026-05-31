// commands/lichsu.js
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { buildHistoryEmbed } = require('../utils/embeds.js');

const data = new SlashCommandBuilder()
  .setName('lich_su')
  .setDescription('Xem 10 phiên điểm danh gần nhất');

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  // [B13 FIX] pass limit=10 để tránh fetch 20 rồi chỉ hiển thị 10
  const history = await db.getSessionHistory(guild.id, 10);
  const embed   = buildHistoryEmbed(history);
  return interaction.editReply({ embeds: [embed] });
}

module.exports = { data, execute };
