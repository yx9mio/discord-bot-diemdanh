// utils/timeCalc.js — Tính thời gian cho scheduler lịch cố định
// Dùng date-fns-tz thay vì tính tay UTC+7
'use strict';
const { toZonedTime } = require('date-fns-tz');

const TZ = 'Asia/Ho_Chi_Minh';

/**
 * Lấy Date object đã được map sang múi giờ VN.
 * Các getter .getFullYear(), .getDay(), .getHours()... đều trả về giờ VN.
 */
function nowVN() {
  return toZonedTime(new Date(), TZ);
}

/**
 * ms đến lần xảy ra tiếp theo của (dayOfWeek, hour, minute) theo giờ VN
 * @param {number} dayOfWeek  0=CN, 1=T2, ..., 6=T7
 * @param {number} hour       0–23
 * @param {number} minute     0–59
 * @returns {number} milliseconds (luôn > 0)
 */
function msToNextWeekday(dayOfWeek, hour, minute) {
  const vn  = nowVN();
  const vnDay = vn.getDay();
  const vnH   = vn.getHours();
  const vnM   = vn.getMinutes();
  const vnS   = vn.getSeconds();
  const vnMs  = vn.getMilliseconds();

  let daysUntil = (dayOfWeek - vnDay + 7) % 7;

  if (daysUntil === 0) {
    const pastOrEqual =
      vnH > hour ||
      (vnH === hour && vnM > minute) ||
      (vnH === hour && vnM === minute && (vnS > 0 || vnMs > 0));
    if (pastOrEqual) daysUntil = 7;
  }

  const MS_DAY         = 24 * 60 * 60 * 1000;
  const msDay          = daysUntil * MS_DAY;
  const msTimeOfDay    = (hour * 60 + minute) * 60 * 1000;
  const msCurrentTime  = ((vnH * 60 + vnM) * 60 + vnS) * 1000 + vnMs;

  return msDay + msTimeOfDay - msCurrentTime;
}

/**
 * ms từ thời điểm mở (open) đến thời điểm đóng (close) trong cùng chu kỳ tuần.
 * Nếu close ≤ open (qua nửa đêm hoặc tuần sau) sẽ thêm 7 ngày.
 */
function msFromOpenToClose(openDay, openH, openM, closeDay, closeH, closeM) {
  const MS_WEEK    = 7 * 24 * 60 * 60 * 1000;
  const openTotal  = (openDay  * 24 * 60 + openH  * 60 + openM)  * 60 * 1000;
  let   closeTotal = (closeDay * 24 * 60 + closeH * 60 + closeM) * 60 * 1000;
  if (closeTotal <= openTotal) closeTotal += MS_WEEK;
  return closeTotal - openTotal;
}

/**
 * ms còn lại cho đến giờ đóng tính từ hiện tại.
 * @param {string|Date|null} sessionCreatedAt  ISO string UTC hoặc null
 * @returns {number|null}  ms (có thể âm nếu đã qua), null nếu createdAt không hợp lệ
 */
function msToCloseFromNow(openDay, openH, openM, closeDay, closeH, closeM, sessionCreatedAt) {
  const openedAt = sessionCreatedAt ? new Date(sessionCreatedAt).getTime() : NaN;
  if (isNaN(openedAt)) return null;
  const duration = msFromOpenToClose(openDay, openH, openM, closeDay, closeH, closeM);
  return openedAt + duration - Date.now();
}

/**
 * Format số giây thành chuỗi đọc được (VD: "1g 2p", "45p", "0 giây")
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0 giây';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0 && m > 0) return `${h}g ${m}p`;
  if (h > 0) return `${h}g`;
  if (m > 0 && s > 0) return `${m}p ${s}s`;
  if (m > 0) return `${m}p`;
  return `${s} giây`;
}

module.exports = { nowVN, msToNextWeekday, msFromOpenToClose, msToCloseFromNow, formatDuration };
