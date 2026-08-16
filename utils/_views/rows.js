'use strict';
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { statusFull } = require('../design-tokens');

/**
 * Row xác nhận Yes / No dùng chung
 * @param {string} confirmId – customId cho nút Confirm
 * @param {string} cancelId  – customId cho nút Cancel
 * @param {string} [confirmLabel='Xác nhận']
 * @param {string} [cancelLabel='Hủy']
 * @returns {ActionRowBuilder}
 */
function buildConfirmRow(confirmId, cancelId, confirmLabel = 'Xác nhận', cancelLabel = 'Hủy') {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(confirmId).setLabel(confirmLabel).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(cancelId).setLabel(cancelLabel).setStyle(ButtonStyle.Secondary),
  );
}

/**
 * Select menu điểm danh cho user
 * @param {boolean} isOpen – true = phiên đang mở, false = phiên đã đóng (disable menu)
 * @returns {ActionRowBuilder}
 */
function buildAttendanceSelectRow(isOpen = true) {
  const select = new StringSelectMenuBuilder()
    .setCustomId('attend_status_select')
    .setPlaceholder('Chọn trạng thái điểm danh...')
    .setDisabled(!isOpen)
    .addOptions([
      { label: 'Tham gia',     value: 'tham_gia',       emoji: statusFull.tham_gia.emoji },
      { label: 'Trễ',          value: 'tre',            emoji: statusFull.tre.emoji },
      { label: 'Không tham gia', value: 'khong_tham_gia', emoji: statusFull.khong_tham_gia.emoji },
      { label: 'Có phép',      value: 'co_phep',        emoji: statusFull.co_phep.emoji },
    ]);
  return new ActionRowBuilder().addComponents(select);
}

/**
 * Action row cho embed phiên điểm danh đang mở/đã đóng (panel ephemeral per-user)
 * @param {boolean} isOpen – true = phiên đang mở, false = phiên đã đóng (disable nút)
 * @returns {ActionRowBuilder[]}
 */
function buildSessionActionRow(isOpen = true) {
  const disabled = !isOpen;
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('attend_refresh')
        .setLabel('🔄 Làm mới')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('admin:mark')
        .setLabel('📝 Điểm danh thay')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('admin:edit')
        .setLabel('✏️ Sửa điểm danh')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('session:cancel')
        .setLabel('🗑️ Hủy Kỳ')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('attend_close')
        .setLabel('🔒 Đóng Kỳ')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled),
    ),
  ];
}

/**
 * Action row cho board shared (read-only) — 2 nút ngang hàng: mở phiếu điểm danh + xem danh sách đầy đủ
 * attend_view chỉ dùng khi phiên mở; attend_list luôn hoạt động (kể cả sau khi đóng).
 * @param {boolean} isOpen
 * @returns {ActionRowBuilder}
 */
function buildBoardRow(isOpen = true) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('attend_view')
      .setLabel('🎫 Điểm danh')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!isOpen),
    new ButtonBuilder()
      .setCustomId('attend_list')
      .setLabel('👁️ Xem danh sách')
      .setStyle(ButtonStyle.Secondary),
  );
}

/**
 * Action row admin cho board shared (read-only)
 * @param {boolean} isOpen
 * @returns {ActionRowBuilder[]}
 */
function buildAdminActionRow(isOpen = true) {
  const disabled = !isOpen;
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin:mark')
        .setLabel('📝 Điểm danh thay')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('admin:edit')
        .setLabel('✏️ Sửa điểm danh')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('session:cancel')
        .setLabel('🗑️ Hủy Kỳ')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('attend_close')
        .setLabel('🔒 Đóng Kỳ')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled),
    ),
  ];
}

/**
 * Row lọc trạng thái cho view danh sách (attend_list) — nút active dạng Primary
 * @param {string} active – 'all' | 'tham_gia' | 'tre' | 'khong_tham_gia' | 'co_phep'
 * @param {string} [sessionId] – UUID phiên để giữ state khi thao tác trên ephemeral view
 * @returns {ActionRowBuilder}
 */
function buildAttendanceFilterRow(active = 'all', sessionId = '') {
  const sid = sessionId ? `:${sessionId}` : '';
  const options = [
    { id: 'all',            label: '📊 Tất cả' },
    { id: 'tham_gia',       label: '✅ Đúng giờ' },
    { id: 'tre',            label: '⏰ Trễ' },
    { id: 'khong_tham_gia', label: '❌ Vắng' },
    { id: 'co_phep',        label: '📋 Có phép' },
  ];
  return new ActionRowBuilder().addComponents(
    options.map(o => new ButtonBuilder()
      .setCustomId(`attend_list:filter:${o.id}${sid}`)
      .setLabel(o.label)
      .setStyle(o.id === active ? ButtonStyle.Primary : ButtonStyle.Secondary)),
  );
}

/**
 * Nav row cho lịch sử điểm danh
 * @param {number} page     – trang hiện tại (0-indexed)
 * @param {number} maxPage  – tổng số trang (0-indexed)
 * @param {string} [prefix='hist'] – prefix cho customId
 * @returns {ActionRowBuilder}
 */
function buildHistoryNavRow(page = 0, maxPage = 0, prefix = 'hist') {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${prefix}:prev`)
      .setLabel('◀ Trước')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(`${prefix}:next`)
      .setLabel('Sau ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= maxPage),
  );
}

module.exports = { buildConfirmRow, buildAttendanceSelectRow, buildSessionActionRow, buildBoardRow, buildAdminActionRow, buildAttendanceFilterRow, buildHistoryNavRow };
