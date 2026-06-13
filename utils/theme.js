// utils/theme.js — Source of truth duy nhất cho COLORS + ICONS
// [FIX-THEME] Merge từ src/utils/theme.js: dùng màu Teal thống nhất, bổ sung keys còn thiếu
// src/utils/theme.js sẽ re-export từ đây — không cần thay đổi import path ở bất kỳ file nào
'use strict';

/** Màu embed chuẩn — palette Teal (Nexus Design System) */
const COLORS = {
  PRIMARY:  0x01696f,  // Teal — màu chính xuyên suốt bot
  SUCCESS:  0x437a22,  // Xanh lá — thành công, phiên active
  WARNING:  0x964219,  // Nâu cam — cảnh báo
  ERROR:    0xa12c7b,  // Đỏ tím — lỗi, hủy, xóa
  NEUTRAL:  0x7a7974,  // Xám — embed phụ, footer
  // Aliases dùng trong _StatsView.js và các embed màu trực tiếp
  GREEN:    0x437a22,  // = SUCCESS
  YELLOW:   0xd19900,  // Vàng — trung bình
  GOLD:     0xd19900,  // = YELLOW — streak, top rank
  RED:      0xa13544,  // Đỏ — cảnh báo mạnh
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
  EDIT:         '✏️',
  TRASH:        '🗑️',
  WARN:         '⚠️',
  // Attendance icons
  ATTEND_YES:   '✅',
  ATTEND_NO:    '❌',
  ATTEND_LATE:  '⏰',
  ATTEND_EXCUSE:'📋',
  SWORD:        '⚔️',
  INACTIVE:     '💤',
};

// ─── Helper: lấy color theo context ──────────────────────────────────
function colorFor(kind) {
  if (COLORS[kind] != null) return COLORS[kind];
  return COLORS.PRIMARY;
}

// ─── Phái emoji mặc định theo vị trí ──────────────────────────────────
const PHAI_EMOJIS = ['🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '🟤', '⚫', '⚪', '🔶', '🔷', '🟩'];

function _emojiName(role) {
  // sanitize: bỏ dấu, lowercase, underscore
  return role.name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function getPhaiIcon(roleId, phaiRoleIds = [], guild = null) {
  if (guild) {
    const role = guild.roles?.cache?.get(roleId);
    // 1. Discord custom emoji đặt tên theo role (đã sanitize)
    if (role) {
      const emojiName = _emojiName(role);
      const serverEmoji = guild.emojis?.cache?.find(e => e.name === emojiName);
      if (serverEmoji) return serverEmoji.toString();
    }
    // 2. Role icon dạng unicode emoji
    if (role?.unicodeEmoji) return role.unicodeEmoji;
  }
  const idx = phaiRoleIds.indexOf(roleId);
  if (idx !== -1 && idx < PHAI_EMOJIS.length) return PHAI_EMOJIS[idx];
  return ICONS.SWORD;
}

function formatPhaiList(phaiRoleIds = [], guild = null) {
  if (!phaiRoleIds?.length) return null;
  return phaiRoleIds.map(id => {
    const icon = getPhaiIcon(id, phaiRoleIds, guild);
    const role = guild?.roles?.cache?.get(id);
    return role ? `${icon} ${role.name}` : `${icon} <@&${id}>`;
  }).join(' · ');
}

module.exports = { COLORS, ICONS, colorFor, getPhaiIcon, formatPhaiList };
