// utils/format.js — Formatters thường dùng cho embed/UI.
// Mục đích: tránh duplicate logic giữa các command (fmtTs/durationStr hiện ở 2+ files).

'use strict';

const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const DAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/**
 * Format ISO timestamp thành "T2 09/06/2026 14:30".
 * Trả về '—' nếu null/undefined/invalid.
 * @param {string} [timeZone] — IANA tz (VD: 'Asia/Ho_Chi_Minh'); mặc định tz máy
 */
function fmtTs(iso, timeZone) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const opts = timeZone ? { timeZone } : {};
  const dowStr = new Intl.DateTimeFormat('en-US', { ...opts, weekday: 'short' }).format(d);
  const day = DAY_NAMES[DAY_INDEX[dowStr]] ?? DAY_NAMES[d.getDay()];
  const date = d.toLocaleDateString('vi-VN', opts);
  const time = d.toLocaleTimeString('vi-VN', { ...opts, hour: '2-digit', minute: '2-digit' });
  return `${day} ${date} ${time}`;
}

/**
 * Tính khoảng thời gian (ms) thành "1h 23m" hoặc "45m".
 * @param {string|Date|number} start
 * @param {string|Date|number} [end] — mặc định now()
 */
function durationStr(start, end) {
  if (!start) return '—';
  const ms = new Date(end ?? Date.now()) - new Date(start);
  if (Number.isNaN(ms) || ms < 0) return '—';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.floor(ms / 1000)}s`;
}

/**
 * Truncate string an toàn (giữ surrogate pair).
 * @param {string} str
 * @param {number} max
 */
function truncate(str, max) {
  if (!str) return '';
  return [...String(str)].slice(0, max).join('');
}

module.exports = { DAY_NAMES, fmtTs, durationStr, truncate };
