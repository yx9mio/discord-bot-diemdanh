// handlers/setup/helpers.js — constants & pure helpers dùng chung trong setup
'use strict';

const TEN_THU      = ['CN','T2','T3','T4','T5','T6','T7'];
const TEN_THU_FULL = ['Chủ Nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
const pad = n => String(n).padStart(2, '0');

const PRESETS = [
  {
    value: 'bang_chien',
    label: '⚔️ Bang Chiến',
    data: { day_of_week:6, hour:21, minute:0, close_day_of_week:6, close_hour:23, close_minute:30 },
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

function ngayThucTe(dayOfWeek, hour, minute, refDay = null, refHour = null, refMinute = null) {
  const VN_OFFSET = 7 * 60 * 60 * 1000;
  const nowVn  = new Date(Date.now() + VN_OFFSET);
  const curDay = nowVn.getUTCDay();
  const curH   = nowVn.getUTCHours();
  const curM   = nowVn.getUTCMinutes();

  let isSameDayBeforeOpen = false;
  if (refDay !== null && dayOfWeek === refDay) {
    const closeMin = hour * 60 + minute;
    const openMin  = refHour * 60 + refMinute;
    if (closeMin < openMin) isSameDayBeforeOpen = true;
  }

  let daysUntil = (dayOfWeek - curDay + 7) % 7;
  if (!isSameDayBeforeOpen) {
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
  const note  = isSameDayBeforeOpen ? '*(trước giờ mở — cùng ngày)*' : null;
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
 * VD: "T7 07/06/2026 21:00 → 07/06/2026 23:30 (2h30p)"
 */
function buildPresetDescription(data) {
  if (!data) return 'Nhập tay qua form';
  try {
    const { label: moLabel } = ngayThucTe(data.day_of_week, data.hour, data.minute);
    const { label: dongLabel, note: dongNote } = ngayThucTe(
      data.close_day_of_week, data.close_hour, data.close_minute,
      data.day_of_week, data.hour, data.minute,
    );
    // Lấy phần dd/MM/yyyy HH:mm từ label dài
    const moShort   = moLabel.replace(/^[^,]+,\s*/, '');   // "07/06/2026 21:00"
    const dongShort = dongLabel.replace(/^[^,]+,\s*/, ''); // "07/06/2026 23:30"
    // Duration
    const durMin = (data.close_day_of_week - data.day_of_week) * 1440
      + (data.close_hour - data.hour) * 60
      + (data.close_minute - data.minute);
    const durNorm = ((durMin % (7 * 1440)) + 7 * 1440) % (7 * 1440);
    const durStr  = durNorm >= 60
      ? `${Math.floor(durNorm / 60)}h${durNorm % 60 ? (durNorm % 60) + 'p' : ''}`
      : `${durNorm}p`;
    const suffix = dongNote ? ` ${dongNote}` : '';
    return `${moShort} → ${dongShort} (${durStr})${suffix}`.slice(0, 100);
  } catch (_) {
    return `${TEN_THU[data.day_of_week]} ${pad(data.hour)}:${pad(data.minute)}`;
  }
}

function parseThuGio(raw) {
  const m = raw.trim().toUpperCase().match(/^(CN|T[2-7])\s+(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const thuMap = { CN: 0, T2: 1, T3: 2, T4: 3, T5: 4, T6: 5, T7: 6 };
  const thu  = thuMap[m[1]];
  const gio  = parseInt(m[2], 10);
  const phut = parseInt(m[3], 10);
  if (gio < 0 || gio > 23 || phut < 0 || phut > 59) return null;
  return { thu, gio, phut };
}

module.exports = { TEN_THU, TEN_THU_FULL, pad, PRESETS, ngayThucTe, formatDongStr, buildPresetDescription, parseThuGio };
