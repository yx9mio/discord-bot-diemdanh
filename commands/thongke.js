// commands/thongke.js — Top 10 leaderboard + stats cá nhân người gọi
const { SlashCommandBuilder } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const db = require('../db.js');
const { buildStatsEmbed, buildProgressBar, pctColor, pctEmoji, FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('../utils/embeds.js');
const { layHuyHieu } = require('../utils/helpers.js');

const data = new SlashCommandBuilder()
  .setName('thong_ke')
  .setDescription('Xem bảng xếp hạng top 10 + thống kê cá nhân của bạn');

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const { guild, user } = interaction;
  const allStats = await db.getAllMemberStats(guild.id);

  // ── Embed 1: Stats cá nhân ──────────────────────────────────────────────────
  const myStats = allStats.find(s => s.user_id === user.id);
  let personalEmbed;
  if (!myStats || myStats.total_sessions === 0) {
    personalEmbed = new EmbedBuilder()
      .setAuthor(AUTHOR_DEFAULT)
      .setTitle('📊 Thống Kê Của Bạn')
      .setDescription('*(Bạn chưa tham gia phiên nào hoặc chưa có dữ liệu)*')
      .setColor(0x99AAB5)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: FOOTER_DEFAULT });
  } else {
    const pct   = Math.round((myStats.total_joined / myStats.total_sessions) * 100);
    const bar   = buildProgressBar(pct, 12);
    const badge = layHuyHieu(myStats.total_joined);
    const rank  = allStats.findIndex(s => s.user_id === user.id) + 1;

    personalEmbed = new EmbedBuilder()
      .setAuthor(AUTHOR_DEFAULT)
      .setTitle('📊 Thống Kê Của Bạn')
      .setColor(pctColor(pct))
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setDescription(
        `${pctEmoji(pct)} \`${bar}\` **${pct}%**\n` +
        `📅 Tham gia: **${myStats.total_joined}** / ${myStats.total_sessions} phiên\n` +
        `🔥 Streak hiện tại: **${myStats.current_streak}** phiên\n` +
        `🏆 Streak tốt nhất: **${myStats.best_streak}** phiên\n` +
        `🏅 Huy hiệu: ${badge || '*(chưa có)*'}\n` +
        `🥇 Xếp hạng server: **#${rank}**`
      )
      .setFooter({ text: FOOTER_DEFAULT })
      .setTimestamp();
  }

  // ── Embed 2: Top 10 leaderboard ─────────────────────────────────────────────
  if (allStats.length === 0) {
    return interaction.editReply({ embeds: [personalEmbed, buildStatsEmbed([])] });
  }

  const lines = allStats.slice(0, 10).map((s, i) => {
    const pct   = s.total_sessions > 0 ? Math.round((s.total_joined / s.total_sessions) * 100) : 0;
    const bar   = buildProgressBar(pct, 8);
    const badge = layHuyHieu(s.total_joined);
    const isMe  = s.user_id === user.id ? ' ◀' : '';
    return `\`${String(i + 1).padStart(2)}.\` <@${s.user_id}> ${badge ? `**${badge}**` : ''} — ${s.total_joined}/${s.total_sessions} *(${pct}%)* \`${bar}\`${isMe}`;
  });

  await interaction.editReply({ embeds: [personalEmbed, buildStatsEmbed(lines)] });
}

module.exports = { data, execute };
