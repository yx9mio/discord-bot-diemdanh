// commands/lichsu.js — Lịch sử phiên với pagination (5 phiên/trang)
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const db = require('../db.js');
const { pctColor, pctEmoji, buildProgressBar, FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('../utils/embeds.js');

const PAGE_SIZE = 5;
const COLOR_GOLD = 0xD4AF37;

function buildHistoryPageEmbed(history, page, totalPages) {
  const start = page * PAGE_SIZE;
  const slice = history.slice(start, start + PAGE_SIZE);

  if (slice.length === 0) {
    return new EmbedBuilder()
      .setAuthor(AUTHOR_DEFAULT)
      .setTitle('📚 Lịch Sử Điểm Danh')
      .setColor(0x99AAB5)
      .setDescription('*(Chưa có phiên nào kết thúc)*')
      .setFooter({ text: FOOTER_DEFAULT });
  }

  const lines = slice.map((s, i) => {
    const idx = start + i + 1;
    const startedAt = s.created_at ?? s.started_at;
    const startTs = Math.floor(new Date(startedAt).getTime() / 1000);
    const endTs   = s.ended_at ? Math.floor(new Date(s.ended_at).getTime() / 1000) : null;

    const eligible = (s.eligible_member_ids ?? []).length;
    const present  = s.present_count ?? 0;  // sẽ tính dưới nếu có
    const pct = eligible > 0 && present > 0 ? Math.round((present / eligible) * 100) : null;
    const bar = pct !== null ? `\`${buildProgressBar(pct, 6)}\` ${pctEmoji(pct)} ${pct}%` : '';

    let line = `\`${String(idx).padStart(2)}.\` **${s.session_name}**\n`;
    line += `    🕐 <t:${startTs}:f>`;
    if (endTs) line += ` → <t:${endTs}:t>`;
    if (bar) line += `  ${bar}`;
    line += `\n    \`ID: ${s.id.slice(0, 8)}…\``;
    return line;
  });

  return new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle(`📚 Lịch Sử Điểm Danh`)
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
      .setCustomId(`lichsu:page:${page}`)
      .setLabel(`${page + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`lichsu:next:${page}`)
      .setLabel('Trang sau ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
  );
}

const data = new SlashCommandBuilder()
  .setName('lich_su')
  .setDescription('Xem lịch sử phiên điểm danh (có phân trang)');

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const history = await db.getSessionHistory(interaction.guild.id, 50);
  const totalPages = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
  const embed = buildHistoryPageEmbed(history, 0, totalPages);
  const row   = buildNavRow(0, totalPages);
  await interaction.editReply({ embeds: [embed], components: totalPages > 1 ? [row] : [] });
}

module.exports = { data, execute, buildHistoryPageEmbed, buildNavRow, PAGE_SIZE };
