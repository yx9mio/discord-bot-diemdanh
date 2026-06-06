'use strict';
// utils/timeUtils.js
// Các hàm tính thời gian cho scheduler — được tách ra để dễ test

const MS_PER_DAY  = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7  * MS_PER_DAY;

/**
 * Tính số ms từ bây giờ đến lần tiếp theo của (dayOfWeek, hour, minute).
 *
 * @param {number} dayOfWeek  0=Chủ Nhật … 6=Thứ Bảy (khớp với Date.getDay())
 * @param {number} hour       0–23
 * @param {number} minute     0–59
 * @returns {number} ms dương; tối thiểu ~1 tuần nếu trùng đúng giờ hiện tại
 */
function msToNextWeekday(dayOfWeek, hour, minute) {
  const now       = new Date();
  const nowMs     = now.getTime();

  // Xây target trong tuần hiện tại (múi giờ local)
  const target    = new Date(now);
  target.setHours(hour, minute, 0, 0);
  const dayDiff   = ((dayOfWeek - now.getDay()) + 7) % 7;
  target.setDate(target.getDate() + dayDiff);

  let ms = target.getTime() - nowMs;
  // Nếu đã qua (hoặc trùng đúng giây này) → lần tiếp theo là tuần sau
  if (ms <= 0) ms += MS_PER_WEEK;
  return ms;
}

/**
 * Tính số ms còn lại từ bây giờ đến giờ đóng phiên.
 *
 * Logic: giờ đóng được xác định tương đối so với giờ mở (có thể sang ngày hôm
 * sau nếu close_day_of_week > open_day_of_week, hoặc giờ đóng < giờ mở).
 * Nếu sessionCreatedAt được cung cấp, tính từ thời điểm phiên thực sự mở thay
 * vì từ lần open tiếp theo trong tuần — đây là trường hợp restore sau restart.
 *
 * @param {number}      openDow          0–6
 * @param {number}      openHour         0–23
 * @param {number}      openMinute       0–59
 * @param {number|null} closeDow         0–6 (null → dùng openDow)
 * @param {number}      closeHour        0–23
 * @param {number}      closeMinute      0–59
 * @param {string|Date|null} sessionCreatedAt  ISO string hoặc Date của lúc phiên mở
 * @returns {number|null} ms dương còn lại, hoặc null nếu thiếu tham số
 */
function msToCloseFromNow(openDow, openHour, openMinute, closeDow, closeHour, closeMinute, sessionCreatedAt = null) {
  if (closeHour == null || closeMinute == null) return null;

  const now       = new Date();
  const effectiveDow = (closeDow != null) ? closeDow : openDow;

  let closeTime;

  if (sessionCreatedAt) {
    // Restore sau restart: tính close dựa trên thời điểm phiên thực sự mở
    const opened = new Date(sessionCreatedAt);
    if (isNaN(opened.getTime())) return null;

    closeTime = new Date(opened);
    closeTime.setHours(closeHour, closeMinute, 0, 0);

    // Tính ngày đóng: số ngày chênh lệch giữa closeDow và openDow trong cùng tuần
    if (closeDow != null) {
      const dayDiff = ((closeDow - opened.getDay()) + 7) % 7;
      closeTime.setDate(closeTime.getDate() + dayDiff);
      // Nếu vẫn trước giờ mở (edge case: close_dow = open_dow nhưng giờ < giờ mở)
      if (closeTime <= opened) closeTime.setDate(closeTime.getDate() + 7);
    } else {
      // Cùng ngày — nếu closeHour < openHour thì sang ngày hôm sau
      if (closeTime <= opened) closeTime.setDate(closeTime.getDate() + 1);
    }
  } else {
    // Lần mở tiếp theo trong tuần
    const msToOpen = msToNextWeekday(openDow, openHour, openMinute);
    const openTime = new Date(now.getTime() + msToOpen);

    closeTime = new Date(openTime);
    closeTime.setHours(closeHour, closeMinute, 0, 0);

    if (closeDow != null) {
      const dayDiff = ((effectiveDow - openTime.getDay()) + 7) % 7;
      closeTime.setDate(closeTime.getDate() + dayDiff);
      if (closeTime <= openTime) closeTime.setDate(closeTime.getDate() + 7);
    } else {
      if (closeTime <= openTime) closeTime.setDate(closeTime.getDate() + 1);
    }
  }

  const ms = closeTime.getTime() - now.getTime();
  return ms > 0 ? ms : null;
}

module.exports = { msToNextWeekday, msToCloseFromNow };
