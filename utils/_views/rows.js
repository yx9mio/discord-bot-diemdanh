// utils/_views/rows.js — STUB (cần điền logic thực)
'use strict';
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function buildConfirmRow(customIdConfirm = 'confirm', customIdCancel = 'cancel') {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(customIdConfirm).setLabel('Xác nhận').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(customIdCancel).setLabel('Huỷ').setStyle(ButtonStyle.Secondary),
  );
}

function buildSessionActionRow(sessionId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`attend_${sessionId}`).setLabel('Điểm danh').setStyle(ButtonStyle.Primary),
  );
}

function buildHistoryNavRow(page = 0, maxPage = 0, prefix = 'hist') {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${prefix}_prev_${page}`).setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(page <= 0),
    new ButtonBuilder().setCustomId(`${prefix}_next_${page}`).setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= maxPage),
  );
}

module.exports = { buildConfirmRow, buildSessionActionRow, buildHistoryNavRow };
