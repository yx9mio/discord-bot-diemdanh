// utils/theme.js — 8 màu semantic + emoji icon library
// Commit 3: chuẩn hoá màu sắc xuyên suốt bot. Mọi embed builder mới
// NÊN dùng COLORS từ đây thay vì hardcode hex.
'use strict';

const COLORS = {
  PRIMARY:  0x5865f2, // Blurple — thương hiệu Discord, dùng cho header
  SUCCESS:  0x57f287, // Xanh lá — thành công, phiên active
  DANGER:   0xed4245, // Đỏ — lỗi, hủy, xóa
  WARNING:  0xfee75c, // Vàng — cảnh báo, pre-close
  INFO:     0x5865f2, // Blurple nhạt — thông tin thường
  GOLD:     0xffd700, // Vàng kim — streak, top rank
  NEUTRAL:  0x36393e, // Xám than — embed phụ, footer text
  ACCENT:   0x9b59b6, // Tím — highlight đặc biệt
  // [FIX-THEME] Alias ngắn gọn cho _StatsView.js và các View dùng màu trực tiếp
  GREEN:    0x57f287, // = SUCCESS
  RED:      0xed4245, // = DANGER
  YELLOW:   0xfee75c, // = WARNING
  ORANGE:   0xf0a500, // Cam — trung bình
};

const ICONS = {
  SESSION:    '🟢',
  CONFIG:     '⚙️',
  SCHEDULE:   '📅',
  MEMBER:     '👥',
  LOG:        '📊',
  HOME:       '🏠',
  CLOCK:      '🕒',
  FIRE:       '🔥',
  BELL:       '🔔',
  CALENDAR:   '📅',
  TROPHY:     '🏆',
  STAR:       '⭐',
  CHART:      '📊',
  SHIELD:     '🛡️',
  GEAR:       '⚙️',
  SPARKLE:    '✨',
  PERSON:     '👤',
  CHANNEL:    '📢',
  ROLE:       '🎭',
  GLOBE:      '🌐',
  PARTY:      '🎉',
  WARN:       '⚠️',
  CHECK:      '✅',
  CROSS:      '❌',
  PLUS:       '➕',
  REFRESH:    '🔄',
  CLOSE:      '⏹️',
  EDIT:       '✏️',
  TRASH:      '🗑️',
  // [FIX-THEME] Attendance icons dùng bởi _StatsView.js, _HistoryView.js...
  ATTEND_YES:    '✅',
  ATTEND_LATE:   '🕐',
  ATTEND_NO:     '❌',
  ATTEND_ABSENT: '📭',
  ATTEND_EXCUSE: '📋',
};

// ─── Helper: lấy color theo context ──────────────────────────────────
function colorFor(kind) {
  if (COLORS[kind] != null) return COLORS[kind];
  return COLORS.PRIMARY;
}

module.exports = { COLORS, ICONS, colorFor };
