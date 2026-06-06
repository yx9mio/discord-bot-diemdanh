// utils/_views/rankView.js
// [FIX] Implement buildRankEmbed(rows, guild, topN)
// Delegate sang _helpers để tái dùng buildRichProgressBar, pctEmoji — không duplicate logic StatsView
'use strict';
const { EmbedBuilder } = require('discord.js');
const { COLORS, ICONS, FOOTER_DEFAULT, buildRichProgressBar, pctEmoji } = require('../_helpers');

/**
 * @param {Array}  rows   – mảng stats rows: { user_id, total_joined, total_sessions, current_streak }
 * @param {import('discord.js').Guild} guild
 * @param {number} topN   – số người hiển thị (mặc định 10)
 * @returns {EmbedBuilder}
 */
function buildRankEmbed(rows = [], guild = null, topN = 10) {
  if (!rows.length) {
    return new EmbedBuilder()
      .setColor(COLORS.GOLD ?? 0xd19900)
      .setTitle(`${ICONS.TROPHY} Bảng xếp hạng`)
      .setDescription('> _Chưa có dữ liệu điểm danh nào._')
      .setFooter({ text: FOOTER_DEFAULT })
      .setTimestamp();
  }

  const medals = ['🥇', '🥈', '🥉'];
  const lines = rows.slice(0, topN).map((r, i) => {
    const medal   = medals[i] ?? `\`${String(i + 1).padStart(2)}.\``;
    const name    = guild?.members?.cache?.get(r.user_id)?.displayName ?? `<@${r.user_id}>`;
    const joined  = r.total_joined ?? 0;
    const total   = r.total_sessions ?? joined;
    const streak  = r.current_streak ?? 0;
    const pct     = total > 0 ? Math.round(joined / total * 100) : 0;
    const bar     = buildRichProgressBar(pct, 8);
    return `${medal} **${name}**\n\`${bar}\` ${pct}% · ${joined} phiên · ${ICONS.FIRE}${streak}`;
  });

  return new EmbedBuilder()
    .setColor(COLORS.GOLD ?? 0xd19900)
    .setTitle(`${ICONS.TROPHY} Top ${Math.min(rows.length, topN)} — Bảng xếp hạng`)
    .setDescription(lines.join('\n\n'))
    .setFooter({ text: `${FOOTER_DEFAULT} · Cập nhật lần cuối` })
    .setTimestamp();
}

module.exports = { buildRankEmbed };
