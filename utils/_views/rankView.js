// utils/_views/rankView.js — buildRankEmbed
'use strict';
const { EmbedBuilder } = require('discord.js');
const { COLORS, FOOTER_DEFAULT, resolveDisplayName } = require('../_helpers');

function buildRankEmbed(rows, guild, topN) {
  const medals = ['🥇', '🥈', '🥉'];
  if (!rows?.length) {
    return new EmbedBuilder()
      .setColor(COLORS.PURPLE)
      .setTitle('🏆 Bảng xếp hạng')
      .setDescription('_Chưa có dữ liệu xếp hạng._')
      .setFooter({ text: FOOTER_DEFAULT })
      .setTimestamp();
  }
  const lines = rows.slice(0, topN ?? 10).map((r, i) => {
    const medal  = medals[i] ?? `\`${String(i + 1).padStart(2)}.\``;
    const name   = resolveDisplayName(guild, r.user_id, `<@${r.user_id}>`);
    const joined = r.total_joined ?? r.tham_gia ?? 0;
    const total  = r.total_sessions ?? 0;
    const streak = r.current_streak ?? r.streak ?? 0;
    const pct    = total > 0 ? Math.round(joined / total * 100) : 0;
    return `${medal} **${name}** — ${joined} phiên · ${pct}% · 🔥 ${streak}`;
  });
  return new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle(`🏆 Top ${Math.min(rows.length, topN ?? 10)} — Bảng xếp hạng`)
    .setDescription(lines.join('\n'))
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();
}

module.exports = { buildRankEmbed };
