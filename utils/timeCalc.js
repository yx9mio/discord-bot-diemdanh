// utils/timeCalc.js — Tính thời gian cho scheduler lịch cố định
'use strict';

// Timezone offset VN (UTC+7)
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Lấy thời điểm hiện tại theo giờ VN (Date object nhưng thời gian là VN local)
 */
function nowVN() {
  const now = new Date();
  return new Date(now.getTime() + TZ_OFFSET_MS);
}

/**
 * ms đến lần xảy ra tiếp theo của (dayOfWeek, hour, minute) theo giờ VN
 * @param {number} dayOfWeek  0=CN, 1=T2, ..., 6=T7
 * @param {number} hour       0–23
 * @param {number} minute     0–59
 * @returns {number} milliseconds
 */
function msToNextWeekday(dayOfWeek, hour, minute) {
  const vn = nowVN();
  const vnDay  = vn.getUTCDay();
  const vnH    = vn.getUTCHours();
  const vnM    = vn.getUTCMinutes();
  const vnS    = vn.getUTCSeconds();
  const vnMs   = vn.getUTCMilliseconds();

  // Số ngày cho đến dayOfWeek tiếp theo
  let daysUntil = (dayOfWeek - vnDay + 7) % 7;

  // Nếu cùng ngày nhưng giờ đã qua (hoặc đúng giờ) → tuần sau
  if (daysUntil === 0) {
    const pastOrEqual =
      vnH > hour ||
      (vnH === hour && vnM > minute) ||
      (vnH === hour && vnM === minute && (vnS > 0 || vnMs > 0));
    if (pastOrEqual) daysUntil = 7;
  }

  const msDay = daysUntil * 24 * 60 * 60 * 1000;
  const msTimeOfDay = (hour * 60 + minute) * 60 * 1000;
  const msCurrentTimeOfDay = ((vnH * 60 + vnM) * 60 + vnS) * 1000 + vnMs;

  return msDay + msTimeOfDay - msCurrentTimeOfDay;
}

/**
 * ms từ thời điểm mở (open) đến thời điểm đóng (close) trong cùng chu kỳ tuần
 * Nếu close ≤ open (qua nửa đêm hoặc tuần sau) sẽ thêm 7 ngày vào close
 */
function msFromOpenToClose(openDay, openH, openM, closeDay, closeH, closeM) {
  const openTotal  = (openDay  * 24 * 60 + openH  * 60 + openM)  * 60 * 1000;
  let   closeTotal = (closeDay * 24 * 60 + closeH * 60 + closeM) * 60 * 1000;

  if (closeTotal <= openTotal) {
    closeTotal += 7 * 24 * 60 * 60 * 1000; // close sang tuần sau
  }

  return closeTotal - openTotal;
}

/**
 * ms còn lại cho đến giờ đóng, tính từ thời điểm hiện tại
 * Căn cứ vào createdAt của session để biết khi nào phiên đã mở
 * @param {string} sessionCreatedAt  ISO string (UTC)
 * @returns {number} ms (có thể âm nếu đã qua giờ đóng)
 */
function msToCloseFromNow(openDay, openH, openM, closeDay, closeH, closeM, sessionCreatedAt) {
  const msOpenToClose = msFromOpenToClose(openDay, openH, openM, closeDay, closeH, closeM);
  const openedAt  = new Date(sessionCreatedAt).getTime();
  const closeAt   = openedAt + msOpenToClose;
  return closeAt - Date.now();
}

module.exports = { msToNextWeekday, msFromOpenToClose, msToCloseFromNow };
