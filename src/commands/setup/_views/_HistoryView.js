// src/commands/setup/_views/_HistoryView.js
// [REDESIGN] Rewrite: fix import path, fix getAllSessions (cũ gọi getSessions không tồn tại)
'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, ICONS } = require('../../../../utils/theme.js');
const { FOOTER_DEFAULT, buildAuthor } = require('../../../../utils/embeds.js');
const { fmtTs, durationStr } = require('../../../../utils/format.js');

const CUSTOM_ID = {
  HISTORY:   'setup:history',
  PAGE_NEXT: 'setup:history:page:next',
  PAGE_PREV: 'setup:history:page:prev',
  REFRESH:   'setup:history:refresh',
  BACK_HOME: 'setup:home',
};

const PAGE_SIZE = 5;

function render({ sessions, page = 0, guild }) {
  const safe      = Array.isArray(sessions) ? sessions : [];
  const total      = safe.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cPage      = Math.max(0, Math.min(page, totalPages - 1));
  const start      = cPage * PAGE_SIZE;
  const slice      = safe.slice(start, start + PAGE_SIZE);

  const desc = total === 0
    ? '*Chưa có Bang Chiến nào.*'
    : slice.map((s, i) => {
        const startTs = Math.floor(new Date(s.started_at).getTime() / 1000);
        const dur     = s.ended_at ? durationStr(s.started_at, s.ended_at) : null;
        const lines   = [
          `**${s.session_name}**`,
          `▸ <t:${startTs}:f>${dur ? `  ⏱ ${dur}` : ''}`,
          `▸ Kênh: ${s.channel_id ? `<#${s.channel_id}>` : '_N/A_'}`,
        ];
        if (s.cancelled) lines.push('▸ ⛔ **Đã hủy**');
        return `\`${String(start + i + 1).padStart(2)}.\` ${lines.join('\n')}`;
      }).join('\n\n');

  const embed = new EmbedBuilder()
    .setColor(COLORS.NEUTRAL)
    .setAuthor(buildAuthor(guild))
    .setTitle(`${ICONS.CHART} Nhật ký Bang Chiến`)
    .setDescription(desc)
    .setFooter({ text: `${FOOTER_DEFAULT} · Trang ${cPage + 1}/${totalPages} · Tổng ${total} Bang Chiến` })
    .setTimestamp();

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.PAGE_PREV).setLabel('◀ Trước').setStyle(ButtonStyle.Secondary).setDisabled(cPage === 0),
    new ButtonBuilder().setCustomId(CUSTOM_ID.PAGE_NEXT).setLabel('Sau ▶').setStyle(ButtonStyle.Secondary).setDisabled(cPage >= totalPages - 1),
    new ButtonBuilder().setCustomId(CUSTOM_ID.REFRESH).setLabel('Làm mới').setEmoji(ICONS.REFRESH).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.BACK_HOME).setLabel('← Dashboard').setEmoji(ICONS.HOME).setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [navRow], _page: cPage, _totalPages: totalPages };
}

module.exports = { HistoryView: { render, CUSTOM_ID, PAGE_SIZE } };
