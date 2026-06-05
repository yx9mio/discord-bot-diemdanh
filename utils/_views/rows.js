// utils/_views/rows.js — ActionRow & button builders
'use strict';
const { ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { ATTENDANCE_OPTIONS } = require('../_helpers');

// ─── Confirm Row ──────────────────────────────────────────────────────────────
function buildConfirmRow(yesId, noId, yesLabel = '✅ Xác nhận', noLabel = '↩️ Hủy') {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(yesId).setLabel(yesLabel).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(noId).setLabel(noLabel).setStyle(ButtonStyle.Secondary),
  );
}

// ─── Session Action Row ───────────────────────────────────────────────────────
function buildSessionActionRow(disabled = false, isAdmin = true) {
  const d = disabled;
  const rows = [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('attendance:select')
        .setPlaceholder('👆 Chọn trạng thái điểm danh...')
        .setDisabled(d)
        .addOptions(
          ATTENDANCE_OPTIONS.map(o =>
            new StringSelectMenuOptionBuilder()
              .setLabel(o.label)
              .setDescription(o.description)
              .setValue(o.value)
          )
        )
    ),
  ];

  if (isAdmin) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('attend_view').setLabel('👁 Xem').setStyle(ButtonStyle.Secondary).setDisabled(d),
        new ButtonBuilder().setCustomId('attend_refresh').setLabel('🔄 Làm mới').setStyle(ButtonStyle.Secondary).setDisabled(d),
        new ButtonBuilder().setCustomId('admin:mark').setLabel('✏️ Điểm danh thay').setStyle(ButtonStyle.Primary).setDisabled(d),
        new ButtonBuilder().setCustomId('session:export_csv').setLabel('📄 Xuất CSV').setStyle(ButtonStyle.Success).setDisabled(d),
        new ButtonBuilder().setCustomId('session:cancel').setLabel('⛔ Hủy phiên').setStyle(ButtonStyle.Danger).setDisabled(d),
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('attend_close').setLabel('🔴 Đóng phiên').setStyle(ButtonStyle.Danger).setDisabled(d),
      ),
    );
  }
  return rows;
}

// ─── History Nav Row ──────────────────────────────────────────────────────────
function buildHistoryNavRow(currentPage, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('history:prev').setLabel('← Trước').setStyle(ButtonStyle.Secondary).setDisabled(currentPage <= 1),
    new ButtonBuilder().setCustomId('history:page').setLabel(`Trang ${currentPage}/${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('history:next').setLabel('Tiếp →').setStyle(ButtonStyle.Secondary).setDisabled(currentPage >= totalPages),
  );
}

module.exports = { buildConfirmRow, buildSessionActionRow, buildHistoryNavRow };
