// src/utils/theme.js
// Màu sắc và icon dùng chung cho toàn bộ embed & view
'use strict';

/** Màu embed chuẩn */
const COLORS = {
  PRIMARY:  0x01696f,  // Teal
  SUCCESS:  0x437a22,  // Green
  WARNING:  0x964219,  // Orange-brown
  ERROR:    0xa12c7b,  // Maroon
  NEUTRAL:  0x7a7974,  // Gray
  // Aliases dùng trong StatsView
  GREEN:    0x437a22,
  YELLOW:   0xd19900,
  GOLD:     0xd19900,
  RED:      0xa13544,
};

/** Emoji icon dùng trong button label, embed title, description */
const ICONS = {
  HOME:         '🏠',
  GEAR:         '⚙️',
  CALENDAR:     '📅',
  MEMBER:       '👥',
  CHANNEL:      '#️⃣',
  ROLE:         '🏷️',
  GLOBE:        '🌐',
  BELL:         '🔔',
  CHECK:        '✅',
  PLUS:         '➕',
  REFRESH:      '🔄',
  CLOSE:        '✖️',
  SESSION:      '🟢',
  CHART:        '📊',
  PERSON:       '👤',
  TROPHY:       '🏆',
  STAR:         '⭐',
  FIRE:         '🔥',
  ATTEND_YES:   '✅',
  ATTEND_NO:    '❌',
  ATTEND_LATE:  '⏰',
  ATTEND_EXCUSE:'📋',
};

module.exports = { COLORS, ICONS };
