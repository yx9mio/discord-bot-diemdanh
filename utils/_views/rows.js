// utils/_views/rows.js
// [FIX] buildSessionActionRow(isOpen) — đúng signature với callers trong sessionButton.js
//   Callers: buildSessionActionRow(false) → row các nút quản lý phiên
//   Không dùng sessionId làm param — customId là cố định theo SESSION_BUTTON_IDS
// [FIX-SELECT] buildAttendanceSelectRow(isOpen) — select menu điểm danh
//   Tách ra khỏi setupSessionStartModal để tái dùng trong attendanceHandler khi update embed
'use strict';
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

/**
 * Row confirm/cancel cho các hành động destructive
 * @param {string} customIdConfirm
 * @param {string} customIdCancel
 * @returns {ActionRowBuilder}
 */
function buildConfirmRow(customIdConfirm = 'confirm', customIdCancel = 'cancel') {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(customIdConfirm).setLabel('✅ Xác nhận').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(customIdCancel).setLabel('↩️ Huỷ').setStyle(ButtonStyle.Secondary),
  );
}

/**
 * Select menu để thành viên tự điểm danh
 * @param {boolean} isOpen – true = phiên đang mở, false = disabled
 * @returns {ActionRowBuilder}
 */
function buildAttendanceSelectRow(isOpen = true) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('attendance:select')
      .setPlaceholder('👆 Chọn trạng thái điểm danh...')
      .setDisabled(!isOpen)
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('✅ Điểm danh').setDescription('Điểm danh đúng giờ').setValue('tham_gia'),
        new StringSelectMenuOptionBuilder().setLabel('⏰ Trễ').setDescription('Điểm danh muộn').setValue('tre'),
        new StringSelectMenuOptionBuilder().setLabel('❌ Không tham gia').setDescription('Báo vắng mặt').setValue('khong_tham_gia'),
      ),
  );
}

/**
 * Action row cho embed phiên điểm danh đang mở/đã đóng
 * @param {boolean} isOpen – true = phiên đang mở, false = phiên đã đóng (disable nút)
 * @returns {ActionRowBuilder[]}
 */
function buildSessionActionRow(isOpen = true) {
  const disabled = !isOpen;
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('attend_view')
        .setLabel('👁️ Xem danh sách')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('attend_refresh')
        .setLabel('🔄 Làm mới')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('admin:mark')
        .setLabel('✏️ Điểm danh thay')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('session:export_csv')
        .setLabel('📄 Xuất CSV')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('session:cancel')
        .setLabel('🗑️ Huỷ phiên')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('attend_close')
        .setLabel('🔒 Đóng phiên')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled),
    ),
  ];
}

/**
 * Nav row cho lịch sử điểm danh
 * @param {number} page     – trang hiện tại (0-indexed)
 * @param {number} maxPage  – trang cuối (0-indexed)
 * @param {string} prefix   – prefix customId
 * @returns {ActionRowBuilder}
 */
function buildHistoryNavRow(page = 0, maxPage = 0, prefix = 'hist') {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${prefix}_prev_${page}`)
      .setLabel('◀ Trang trước')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(`${prefix}_next_${page}`)
      .setLabel('Trang sau ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= maxPage),
  );
}

module.exports = { buildConfirmRow, buildAttendanceSelectRow, buildSessionActionRow, buildHistoryNavRow };
