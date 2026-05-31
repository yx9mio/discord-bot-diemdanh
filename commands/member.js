// commands/member.js
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { buildMemberEmbed } = require('../utils/embeds.js');
const { layHuyHieu } = require('../utils/helpers.js');
const { buildProgressBar } = require('../utils/progress.js');

const data = new SlashCommandBuilder()
  .setName('xem_thanh_vien')
  .setDescription('Xem thống kê của một thành viên')
  .addUserOption(o => o.setName('thanh_vien').setDescription('Thành viên (bỏ trống = bản thân)'));

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const target = interaction.options.getUser('thanh_vien') ?? interaction.user;
  const member = await interaction.guild.members.fetch(target.id).catch(() => null);

  if (!member) return interaction.editReply({ content: '⚠️ Không tìm thấy thành viên.' });

  const stats = await db.getMemberStats(interaction.guild.id, target.id);
  const pct   = stats.total_sessions > 0 ? Math.round((stats.total_joined / stats.total_sessions) * 100) : 0;
  const bar   = buildProgressBar(pct);
  const badge = layHuyHieu(stats.total_joined);

  await interaction.editReply({ embeds: [buildMemberEmbed(member, stats, badge, pct, bar)] });
}

module.exports = { data, execute };
