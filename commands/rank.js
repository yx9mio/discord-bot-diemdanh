// commands/rank.js — Bảng xếp hạng tham dự top 10 server (ephemeral)
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db.js');
const { layHuyHieu } = require('../utils/helpers.js');
const { buildProgressBar } = require('../utils/progress.js');
const { pctEmoji, COLOR_GOLD, FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('../utils/embeds.js');

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Bảng xếp hạng tham dự top 10 của server'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild, user } = interaction;

    const rows = await db.getTopMembers(guild.id, 10);
    if (!rows.length) {
      return interaction.editReply({ content: '📭 Chưa có dữ liệu điểm danh nào.' });
    }

    const lines = await Promise.all(rows.map(async (row, i) => {
      let name = row.display_name ?? `<@${row.user_id}>`;
      try {
        const m = await guild.members.fetch(row.user_id).catch(() => null);
        if (m) name = m.nickname ?? m.user.globalName ?? m.user.username;
      } catch (_) { /* silent */ }

      const pct   = row.total_sessions > 0 ? Math.round((row.total_joined / row.total_sessions) * 100) : 0;
      const bar   = buildProgressBar(pct, 8);
      const badge = layHuyHieu(row.total_joined);
      const medal = RANK_MEDALS[i] ?? `\`${String(i + 1).padStart(2)}.\``;
      const you   = row.user_id === user.id ? ' ◀ **Bạn**' : '';

      return [
        `${medal} **${name}**${you} ${badge ? `· ${badge}` : ''}`,
        `> ${pctEmoji(pct)} \`${bar}\` **${pct}%** (${row.total_joined}/${row.total_sessions}) · 🔥 Streak: ${row.current_streak}`,
      ].join('\n');
    }));

    // Tìm rank của caller nếu không trong top 10
    const callerInTop = rows.some(r => r.user_id === user.id);
    let callerNote = '';
    if (!callerInTop) {
      const callerStats = await db.getMemberStats(guild.id, user.id).catch(() => null);
      if (callerStats) {
        const allRows = await db.getTopMembers(guild.id, 100);
        const callerRank = allRows.findIndex(r => r.user_id === user.id);
        if (callerRank >= 0) {
          const pct = callerStats.total_sessions > 0
            ? Math.round((callerStats.total_joined / callerStats.total_sessions) * 100) : 0;
          callerNote = `\n\n📍 *Vị trí của bạn: #${callerRank + 1} — **${pct}%** (${callerStats.total_joined}/${callerStats.total_sessions})*`;
        }
      }
    }

    const embed = new EmbedBuilder()
      .setAuthor(AUTHOR_DEFAULT)
      .setTitle('🏆 Bảng Xếp Hạng Điểm Danh')
      .setColor(COLOR_GOLD)
      .setDescription(lines.join('\n\n') + callerNote)
      .setFooter({ text: `${FOOTER_DEFAULT} · Xếp hạng theo số lần tham gia` })
      .setTimestamp();

    if (guild.iconURL()) embed.setThumbnail(guild.iconURL({ dynamic: true }));

    return interaction.editReply({ embeds: [embed] });
  },
};
