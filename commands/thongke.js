// commands/thongke.js
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { buildStatsEmbed } = require('../utils/embeds.js');
const { layHuyHieu } = require('../utils/helpers.js');
const { buildProgressBar } = require('../utils/progress.js');

const data = new SlashCommandBuilder()
  .setName('thong_ke')
  .setDescription('Xem top 10 thành viên chuyên cần');

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const allStats = await db.getAllMemberStats(interaction.guild.id);

  if (allStats.length === 0) {
    return interaction.editReply({ embeds: [buildStatsEmbed([])] });
  }

  const lines = allStats.slice(0, 10).map((s, i) => {
    const pct   = s.total_sessions > 0 ? Math.round((s.total_joined / s.total_sessions) * 100) : 0;
    const bar   = buildProgressBar(pct, 8);
    const badge = layHuyHieu(s.total_joined);
    return `\`${String(i + 1).padStart(2)}.\` <@${s.user_id}> ${badge ? `**${badge}**` : ''} — ${s.total_joined}/${s.total_sessions} *(${pct}%)* \`${bar}\``;
  });

  await interaction.editReply({ embeds: [buildStatsEmbed(lines)] });
}

module.exports = { data, execute };
