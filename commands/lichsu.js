// commands/lichsu.js
// Sync với design system embeds.js — dùng AUTHOR_DEFAULT, COLORS, ICONS, buildHistoryEmbed
'use strict';
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../db.js');
const {
  AUTHOR_DEFAULT, FOOTER_DEFAULT, COLORS, ICONS,
  buildHistoryEmbed,
} = require('../utils/embeds.js');

const PAGE_SIZE = 5;

/**
 * Trang lịch sử — dùng design system thống nhất từ embeds.js
 * buildHistoryEmbed đã render đầy đủ danh sách; ở đây chỉ slice theo trang.
 */
function buildHistoryPageEmbed(history, page, totalPages) {
  const { EmbedBuilder } = require('discord.js');
  const start = page * PAGE_SIZE;
  const slice = history.slice(start, start + PAGE_SIZE);

  const lines = slice.map((s, i) => {
    const num  = start + i + 1;
    const startedAt = s.created_at ?? s.started_at;
    const ts    = startedAt ? Math.floor(new Date(startedAt).getTime() / 1000) : null;
    const dateStr = ts ? `<t:${ts}:d>` : '?';
    const eligible = (s.eligible_member_ids ?? []).length;
    return [
      `\`${String(num).padStart(2)}.\` **${s.session_name ?? 'Điểm danh'}** — ${dateStr}`,
      `> \`ID: ${s.id}\`  ·  ${eligible} thành viên`,
    ].join('\n');
  });

  return new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle(`${ICONS.HISTORY} Lịch Sử Điểm Danh — Trang ${page + 1}/${totalPages}`)
    .setColor(COLORS.GOLD)
    .setDescription(lines.join('\n') || '> Không có dữ liệu.')
    .setFooter({ text: `${FOOTER_DEFAULT} · Dùng ID với /thong_ke và /thongke_server` })
    .setTimestamp();
}

function buildNavRow(page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`lichsu:prev:${page}`)
      .setLabel('◄ Trước')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`lichsu:next:${page}`)
      .setLabel('Tiếp ►')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lich_su')
    .setDescription('Xem lịch sử các phiên điểm danh')
    .setDefaultMemberPermissions(0n),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const history    = await db.getSessionHistory(interaction.guild.id, 50);
    const totalPages = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
    const embed      = buildHistoryPageEmbed(history, 0, totalPages);
    const row        = buildNavRow(0, totalPages);
    return interaction.editReply({ embeds: [embed], components: totalPages > 1 ? [row] : [] });
  },

  buildHistoryPageEmbed,
  buildNavRow,
  PAGE_SIZE,
};
