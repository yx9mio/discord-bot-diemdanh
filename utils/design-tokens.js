'use strict';

const COLORS = {
  GREEN:   0x57f287,
  RED:     0xff4444,
  BLUE:    0x5865f2,
  YELLOW:  0xfee75c,
  ORANGE:  0xf0a500,
  GREY:    0x36393e,
  PURPLE:  0x9b59b6,
  TEAL:    0x1abc9c,
  PRIMARY: 0x01696f,
  GOLD:    0xFFD700,
  SUCCESS: 0x57f287,
  PINK:    0xeb459e,
  BLURPLE: 0x5865f2,
  DISCORD_RED: 0xed4245,
};

const ICONS = {
  SESSION_OPEN:   '🟢',
  SESSION_CLOSED: '🔴',
  ATTEND_YES:     '✅',
  ATTEND_LATE:    '⏰',
  ATTEND_NO:      '❌',
  ATTEND_ABSENT:  '💭',
  ATTEND_EXCUSE:  '📋',
  PERSON:         '👤',
  CLOCK:          '🕒',
  SWORD:          '⚔️',
  STAR:           '⭐',
  TROPHY:         '🏆',
  CHART:          '📊',
  CALENDAR:       '📅',
  FIRE:           '🔥',
  SHIELD:         '🛡️',
  SPARKLE:        '✨',
  BELL:           '🔔',
  GEAR:           '⚙️',
  ID:             '🆔',
  REFRESH:        '🔄',
  HOME:           '🏠',
  MEMBER:         '👥',
  STATS:          '📈',
  HISTORY:        '📜',
  SETTINGS:       '🔧',
};

const FOOTER_DEFAULT = 'Quản Gia · Bot Điểm Danh';
const AUTHOR_DEFAULT = { name: 'Quản Gia · Bot Điểm Danh' };
const COLOR_GOLD = COLORS.GOLD;

const ATTENDANCE_OPTIONS = [
  { label: '✅ Tham gia', description: 'Điểm danh đúng giờ', value: 'tham_gia'        },
  { label: '⏰ Trễ',      description: 'Điểm danh muộn',      value: 'tre'             },
  { label: '❌ Vắng',    description: 'Báo vắng mặt',        value: 'khong_tham_gia' },
  { label: '📋 Có phép', description: 'Vắng mặt có lý do',   value: 'co_phep'        },
];

const STATUS_CONFIG = Object.freeze({
  tham_gia:       Object.freeze({ label: 'Tham gia', shortLabel: 'Đúng giờ', emoji: ICONS.ATTEND_YES,     color: COLORS.GREEN }),
  tre:            Object.freeze({ label: 'Trễ',      shortLabel: 'Trễ',       emoji: ICONS.ATTEND_LATE,    color: COLORS.YELLOW }),
  khong_tham_gia: Object.freeze({ label: 'Vắng',     shortLabel: 'Vắng',      emoji: ICONS.ATTEND_NO,      color: COLORS.DISCORD_RED }),
  co_phep:        Object.freeze({ label: 'Có phép',  shortLabel: 'Có phép',   emoji: ICONS.ATTEND_EXCUSE,  color: COLORS.PINK }),
});

function statusFull(status) {
  const cfg = STATUS_CONFIG[status];
  return cfg ? `${cfg.emoji} ${cfg.label}` : `❓ ${status}`;
}

module.exports = {
  COLORS, ICONS, FOOTER_DEFAULT, AUTHOR_DEFAULT, COLOR_GOLD,
  ATTENDANCE_OPTIONS, STATUS_CONFIG, statusFull,
};
