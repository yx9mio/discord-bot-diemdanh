// src/utils/format.js
// Tiện ích format ngày giờ, chuỗi dùng chung
'use strict';

/** Tên ngày trong tuần tiếng Việt (0=CN, 1=T2, ..., 6=T7) */
const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/**
 * Format timestamp ISO/Date thành chuỗi ngày giờ tiếng Việt
 * @param {string|Date|number} ts
 * @param {string} [tz='Asia/Ho_Chi_Minh']
 * @returns {string}
 */
function fmtTs(ts, tz = 'Asia/Ho_Chi_Minh') {
  if (!ts) return '_N/A_';
  try {
    const date = new Date(ts);
    return date.toLocaleString('vi-VN', {
      timeZone: tz,
      day:    '2-digit',
      month:  '2-digit',
      year:   'numeric',
      hour:   '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(ts);
  }
}

/**
 * Format duration (milliseconds) thành chuỗi "Xh Ym"
 * @param {number} ms
 * @returns {string}
 */
function durationStr(ms) {
  if (!ms || ms < 0) return '0p';
  const totalMinutes = Math.floor(ms / 60000);
  const hours   = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}p`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}p`;
}

module.exports = { DAY_NAMES, fmtTs, durationStr };
