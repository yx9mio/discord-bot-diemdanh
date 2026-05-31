// handlers/setup/helpers.js — constants & pure helpers dùng chung trong setup
'use strict';

const TEN_THU      = ['CN','T2','T3','T4','T5','T6','T7'];
const TEN_THU_FULL = ['Chủ Nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
const pad = n => String(n).padStart(2, '0');

const PRESETS = [
  {
    value: 'bang_chien',
    label: '⚔️ Bang Chiến',
    data: { day_of_week:6, hour:21, minute:0, close_day_of_week:6, close_hour:20, close_minute:0 },
  },
  {
    value: 'hoi_dong',
    label: '🏛️ Hội Đồng Môn Phái',
    data: { day_of_week:0, hour:20, minute:0, close_day_of_week:0, close_hour:22, close_minute:0 },
  },
  {
    value: 'luyen_tap',
    label: '🥋 Luyện Tập Thường',
    data: { day_of_week:2, hour:20, minute:0, close_day_of_week:2, close_hour:21, close_minute:30 },
  },
  {
    value: 'tuy_chinh',
    label: '✏️ Tùy chỉnh',
    data: null,
  },
];

/**
 * ngayThucTe(dayOfWeek, hour, minute, refDay?, refHour?, refMinute?)
 *
 * Trả về label ngày giờ VN gần nhất cho (dayOfWeek, hour, minute).
 *
 * Khi được gọi cho giờ ĐÓNG (refDay/refHour/refMinute là giờ MỞ):
 *   - Nếu close_day == open_day VÀ close_time < open_time
 *     → đóng thuộc tuần SAU ngày mở (cộng 7 ngày vào ngày mở)
 */
function ngayThucTe(dayOfWeek, hour, minute, refDay = null, refHour = null, refMinute = null) {
  const VN_OFFSET = 7 * 60 * 60 * 1000;
  const nowVn  = new Date(Date.now() + VN_OFFSET);
  const curDay = nowVn.getUTCDay();
  const curH   = nowVn.getUTCHours();
  const curM   = nowVn.getUTCMinutes();

  // Phát hiện trường hợp: close cùng thứ nhưng giờ trước giờ mở → đóng tuần sau
  const isSameDayBeforeOpen =
    refDay !== null &&
    dayOfWeek === refDay &&
    (hour * 60 + minute) < (refHour * 60 + refMinute);

  let daysUntil;

  if (isSameDayBeforeOpen) {
    // Tính ngày mở gần nhất, rồi cộng 7 → ngày đóng
    let daysUntilOpen = (refDay - curDay + 7) % 7;
    if (daysUntilOpen === 0) {
      const curSec  = curH * 3600 + curM * 60;
      const openSec = refHour * 3600 + refMinute * 60;
      if (curSec >= openSec) daysUntilOpen = 7;
    }
    daysUntil = daysUntilOpen + 7;
  } else {
    daysUntil = (dayOfWeek - curDay + 7) % 7;
    if (daysUntil === 0) {
      const secPassed = curH * 3600 + curM * 60;
      const secTarget = hour * 3600 + minute * 60;
      if (secPassed >= secTarget) daysUntil = 7;
    }
  }

  const target = new Date(nowVn.getTime() + daysUntil * 86400000);
  const dd   = pad(target.getUTCDate());
  const mm   = pad(target.getUTCMonth() + 1);
  const yyyy = target.getUTCFullYear();
  const label = `${TEN_THU_FULL[dayOfWeek]}, ${dd}/${mm}/${yyyy} ${pad(hour)}:${pad(minute)}`;
  const note  = isSameDayBeforeOpen ? '*(đóng tuần sau)*' : null;
  return { label, note };
}

function formatDongStr(lich) {
  if (lich.close_day_of_week == null) return 'Không tự đóng';
  const { label, note } = ngayThucTe(
    lich.close_day_of_week, lich.close_hour, lich.close_minute,
    lich.day_of_week, lich.hour, lich.minute,
  );
  return note ? `${label} ${note}` : label;
}

/**
 * buildPresetDescription(data)
 * Tính description động cho preset tại runtime.
 * Discord option description giới hạn 100 ký tự.
 */
function buildPresetDescription(data) {
  if (!data) return 'Nhập tay qua form';
  try {
    const { label: moLabel } = ngayThucTe(data.day_of_week, data.hour, data.minute);
    const { label: dongLabel, note: dongNote } = ngayThucTe(
      data.close_day_of_week, data.close_hour, data.close_minute,
      data.day_of_week, data.hour, data.minute,
    );
    // Lấy phần dd/MM/YYYY HH:mm (bỏ tên thứ để tiết kiệm ký tự)
    const short = s => s.replace(/^[^,]+,\s*/, '');
    const suffix = dongNote ? ` ${dongNote}` : '';
    const desc = `${short(moLabel)} → ${short(dongLabel)}${suffix}`;
    return desc.length <= 100 ? desc : desc.slice(0, 97) + '…';
  } catch {
    return 'Xem chi tiết khi chọn';
  }
}

module.exports = { TEN_THU, TEN_THU_FULL, pad, PRESETS, ngayThucTe, formatDongStr, buildPresetDescription };
