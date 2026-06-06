// src/commands/setup/_views/_HistoryView.js
// [REDESIGN] Rewrite: fix import path, fix getAllSessions (cũ gọi getSessions không tồn tại)
'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, ICONS } = require('../../../../utils/theme.js');
const { FOOTER_DEFAULT } = require('../../../../utils/embeds.js');
const { fmtTs, durationStr } = require('../../../../utils/format.js');
const sessionService = require('../../../../services/sessionService.js');

const CUSTOM_ID = {
  PAGE_NEXT: 'setup:history:page:next',
  PAGE_PREV: 'setup:history:page:prev',
  REFRESH:   'setup:history:refresh',
  BACK_HOME: 'setup:home',
};

const PAGE_SIZE = 5;

function render({ sessions, page = 0, guild }) {
  const total      = sessions.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cPage      = Math.max(0, Math.min(page, totalPages - 1));
  const start      = cPage * PAGE_SIZE;
  const slice      = sessions.slice(start, start + PAGE_SIZE);

  const desc = total === 0
    ? '*Chưa có phiên nào.*'
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
    .setColor(COLORS.PRIMARY)
    .setTitle(`${ICONS.CHART} Nhật ký phiên — ${guild.name}`)
    .setDescription(desc)
    .setFooter({ text: `${FOOTER_DEFAULT} · Trang ${cPage + 1}/${totalPages} · Tổng ${total} phiên` })
    .setTimestamp();

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.PAGE_PREV).setLabel('◀ Trước').setStyle(ButtonStyle.Secondary).setDisabled(cPage === 0),
    new ButtonBuilder().setCustomId(CUSTOM_ID.PAGE_NEXT).setLabel('Sau ▶').setStyle(ButtonStyle.Secondary).setDisabled(cPage >= totalPages - 1),
    new ButtonBuilder().setCustomId(CUSTOM_ID.REFRESH).setLabel('Làm mới').setEmoji(ICONS.REFRESH).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.BACK_HOME).setLabel('← Dashboard').setEmoji(ICONS.HOME).setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [navRow], _page: cPage, _totalPages: totalPages };
}

async function handleRefresh(interaction, page = 0) {
  await interaction.deferUpdate();
  // [FIX] getAllSessions thay vì getSessions (hàm không tồn tại)
  const sessions = await sessionService.getAllSessions(interaction.guild.id);
  return interaction.editReply(render({ sessions, page, guild: interaction.guild }));
}

module.exports = { HistoryView: { render, handleRefresh, CUSTOM_ID, PAGE_SIZE } };
