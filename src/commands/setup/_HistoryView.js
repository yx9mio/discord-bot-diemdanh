'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, ICONS } = require('../../../utils/theme.js');
const { FOOTER_DEFAULT } = require('../../../utils/embeds.js');
const { fmtTs, durationStr } = require('../../../utils/format.js');

const CUSTOM_ID = {
  PAGE_NEXT: 'setup:history:page:next',
  PAGE_PREV: 'setup:history:page:prev',
  BACK_HOME: 'setup:home',
};

const PAGE_SIZE = 5;

function render({ sessions, page = 0, guild }) {
  const total = sessions.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const clampedPage = Math.max(0, Math.min(page, totalPages - 1));
  const start = clampedPage * PAGE_SIZE;
  const slice = sessions.slice(start, start + PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`${ICONS.CHART} Nhật ký phiên — ${guild.name}`)
    .setDescription(
      total === 0
        ? '*Chưa có phiên nào.*'
        : slice.map((s, i) => {
            const dur = s.ended_at ? durationStr(s.created_at, s.ended_at) : null;
            const startTs = Math.floor(new Date(s.created_at).getTime() / 1000);
            const line = [
              `**${s.session_name}**`,
              `▸ <t:${startTs}:f>${dur ? `  ⏱ ${dur}` : ''}`,
              `▸ Kênh: ${s.channel_id ? `<#${s.channel_id}>` : '_N/A_'}`,
            ];
            if (s.cancelled) line.push('▸ ⛔ **Đã hủy**');
            return `\`${String(start + i + 1).padStart(2)}.\` ${line.join('\n')}`;
          }).join('\n\n')
    )
    .setFooter({ text: `${FOOTER_DEFAULT} · Trang ${clampedPage + 1}/${totalPages} · Tổng ${total} phiên` })
    .setTimestamp();

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.PAGE_PREV)
      .setLabel('◀ Trước')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(clampedPage === 0),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.PAGE_NEXT)
      .setLabel('Sau ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(clampedPage >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.BACK_HOME)
      .setLabel('← Về Bảng điều khiển')
      .setEmoji(ICONS.HOME)
      .setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [navRow], _page: clampedPage, _totalPages: totalPages };
}

module.exports = { HistoryView: { render, CUSTOM_ID, PAGE_SIZE } };
