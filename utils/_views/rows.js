'use strict';
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { STATUS_CONFIG } = require('../design-tokens');

function buildConfirmRow(confirmId, cancelId, confirmLabel = 'Xác nhận', cancelLabel = 'Hủy') {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(confirmId).setLabel(confirmLabel).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(cancelId).setLabel(cancelLabel).setStyle(ButtonStyle.Secondary),
  );
}

function buildAttendanceSelectRow(isOpen = true) {
  const select = new StringSelectMenuBuilder()
    .setCustomId('attendance:select')
    .setPlaceholder('Chọn trạng thái điểm danh...')
    .setDisabled(!isOpen)
    .addOptions([
      { label: 'Tham gia', value: 'tham_gia', emoji: STATUS_CONFIG.tham_gia.emoji },
      { label: 'Trễ', value: 'tre', emoji: STATUS_CONFIG.tre.emoji },
      { label: 'Không tham gia', value: 'khong_tham_gia', emoji: STATUS_CONFIG.khong_tham_gia.emoji },
      { label: 'Có phép', value: 'co_phep', emoji: STATUS_CONFIG.co_phep.emoji },
    ]);
  return new ActionRowBuilder().addComponents(select);
}

/** [UX-P2] Xác nhận riêng sau khi chọn trạng thái — ✅ ghi nhận / ↩️ đổi trạng thái */
function buildAttendanceConfirmRow(sid, status) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`attendance:confirm:${sid}:${status}`)
      .setLabel('✅ Xác nhận')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('attendance:change')
      .setLabel('↩️ Đổi trạng thái')
      .setStyle(ButtonStyle.Secondary),
  );
}

function buildSessionActionRow(isOpen = true) {
  const disabled = !isOpen;
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('attend_refresh').setLabel('🔄 Làm mới').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
      new ButtonBuilder().setCustomId('admin:mark').setLabel('📝 Điểm danh thay').setStyle(ButtonStyle.Primary).setDisabled(disabled),
      new ButtonBuilder().setCustomId('admin:edit').setLabel('✏️ Sửa điểm danh').setStyle(ButtonStyle.Primary).setDisabled(disabled),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('session:cancel').setLabel('🗑️ Hủy Kỳ').setStyle(ButtonStyle.Danger).setDisabled(disabled),
      new ButtonBuilder().setCustomId('attend_close').setLabel('🔒 Đóng Kỳ').setStyle(ButtonStyle.Danger).setDisabled(disabled),
    ),
  ];
}

function buildBoardRow(isOpen = true) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('attend_view').setLabel('🎫 Điểm danh').setStyle(ButtonStyle.Secondary).setDisabled(!isOpen),
    new ButtonBuilder().setCustomId('attend_list').setLabel('👁️ Xem danh sách').setStyle(ButtonStyle.Secondary),
  );
}

function buildAdminActionRow(isOpen = true) {
  const disabled = !isOpen;
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('admin:mark').setLabel('📝 Điểm danh thay').setStyle(ButtonStyle.Primary).setDisabled(disabled),
      new ButtonBuilder().setCustomId('admin:edit').setLabel('✏️ Sửa điểm danh').setStyle(ButtonStyle.Primary).setDisabled(disabled),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('session:cancel').setLabel('🗑️ Hủy Kỳ').setStyle(ButtonStyle.Danger).setDisabled(disabled),
      new ButtonBuilder().setCustomId('attend_close').setLabel('🔒 Đóng Kỳ').setStyle(ButtonStyle.Danger).setDisabled(disabled),
    ),
  ];
}

function buildAttendanceFilterRow(active = 'all', sessionId = '') {
  const sid = sessionId ? `:${sessionId}` : '';
  const options = [
    { id: 'all', label: '📊 Tất cả' },
    { id: 'tham_gia', label: '✅ Đúng giờ' },
    { id: 'tre', label: '⏰ Trễ' },
    { id: 'khong_tham_gia', label: '❌ Vắng' },
    { id: 'co_phep', label: '📋 Có phép' },
  ];
  return new ActionRowBuilder().addComponents(
    options.map(o => new ButtonBuilder()
      .setCustomId(`attend_list:filter:${o.id}${sid}`)
      .setLabel(o.label)
      .setStyle(o.id === active ? ButtonStyle.Primary : ButtonStyle.Secondary)),
  );
}

function buildHistoryNavRow(page = 0, maxPage = 0, prefix = 'hist') {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${prefix}:prev`).setLabel('◀ Trước').setStyle(ButtonStyle.Secondary).setDisabled(page <= 0),
    new ButtonBuilder().setCustomId(`${prefix}:next`).setLabel('Sau ▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= maxPage),
  );
}

module.exports = { buildConfirmRow, buildAttendanceSelectRow, buildAttendanceConfirmRow, buildSessionActionRow, buildBoardRow, buildAdminActionRow, buildAttendanceFilterRow, buildHistoryNavRow };
