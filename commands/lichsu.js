// commands/lichsu.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../db.js');

export const PAGE_SIZE = 5;

function buildHistoryPageEmbed(history, page, totalPages) {
  const start = page * PAGE_SIZE;
  const slice = history.slice(start, start + PAGE_SIZE);

  const lines = slice.map((s, i) => {
    const num  = start + i + 1;
    const date = s.ended_at ? new Date(s.ended_at).toLocaleDateString('vi-VN') : '?';
    return `**${num}.** ${s.session_name ?? 'Điểm danh'} — ${date}`;
  });

  return new EmbedBuilder()
    .setTitle('🗓️ Lịch Sử Điểm Danh')
    .setColor(0x5865F2)
    .setDescription(lines.join('\n') || 'Không có dữ liệu.')
    .setFooter({ text: `Trang ${page + 1} / ${totalPages}` })
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
