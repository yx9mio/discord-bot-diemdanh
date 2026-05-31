// commands/lichsu.js — Lịch sử điểm danh với pagination
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../db.js');
const { COLOR_GOLD, FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('../utils/embeds.js');

const PAGE_SIZE = 5;

function buildHistoryPageEmbed(history, page, totalPages) {
  if (history.length === 0) {
    return new EmbedBuilder()
      .setAuthor(AUTHOR_DEFAULT)
      .setTitle('📚 Lịch Sử Điểm Danh')
      .setColor(0x99AAB5)
      .setDescription('*(Chưa có phiên nào kết thúc)*')
      .setFooter({ text: FOOTER_DEFAULT });
  }

  const start = page * PAGE_SIZE;
  const slice = history.slice(start, start + PAGE_SIZE);

  const lines = slice.map((s, i) => {
    const startedAt = s.created_at ?? s.started_at;
    const startTs   = Math.floor(new Date(startedAt).getTime() / 1000);
    const endTs     = s.ended_at ? Math.floor(new Date(s.ended_at).getTime() / 1000) : null;
    const shortId   = String(s.id).slice(0, 8);
    const present   = (s.joined_count ?? 0) + (s.late_count ?? 0);
    const eligible  = s.eligible_count ?? 0;
    const pct       = eligible > 0 ? Math.round((present / eligible) * 100) : 0;
    const pctEmoji  = pct >= 80 ? '🟢' : pct >= 50 ? '🟡' : '🔴';
    const timeRange = endTs
      ? `<t:${startTs}:f> → <t:${endTs}:t>`
      : `<t:${startTs}:f> *(đang mở)*`;
    return [
      `**${start + i + 1}. ${s.session_name}**`,
      `> ${pctEmoji} **${pct}%** (${present}/${eligible}) · ${timeRange}`,
      `> \`ID: ${shortId}…\``,
    ].join('\n');
  });

  return new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle(`📚 Lịch Sử Điểm Danh (${history.length} phiên)`)
    .setColor(COLOR_GOLD)
    .setDescription(lines.join('\n\n'))
    .setFooter({ text: `${FOOTER_DEFAULT} · Trang ${page + 1}/${totalPages} · Tổng ${history.length} phiên` })
    .setTimestamp();
}

function buildNavRow(page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`lichsu:prev:${page}`)
      .setLabel('◀ Trang trước')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`lichsu:next:${page}`)
      .setLabel('Trang sau ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lich_su')
    .setDescription('Xem lịch sử các phiên điểm danh (có phân trang)'),
  PAGE_SIZE,
  buildHistoryPageEmbed,
  buildNavRow,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const history = await db.getSessionHistory(interaction.guild.id, 50);
    const totalPages = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
    const embed = buildHistoryPageEmbed(history, 0, totalPages);
    const components = totalPages > 1 ? [buildNavRow(0, totalPages)] : [];
    return interaction.editReply({ embeds: [embed], components });
  },
};
