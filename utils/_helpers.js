// utils/_helpers.js — Shared constants & helpers dùng bởi _views/*.js
// Không import từ embeds.js để tránh circular dependency
'use strict';
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const { getPhaiIcon } = require('./theme.js');

// ─── Palette & Icons ───────────────────────────────────────────────────────
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
  // [Phase-D] thêm các icon dùng bởi _ScheduleView, _SessionView, _HomeView
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

// ─── [#2] Attendance options — single source of truth ────────────────────────
const ATTENDANCE_OPTIONS = [
  { label: '✅ Tham gia', description: 'Điểm danh đúng giờ', value: 'tham_gia'        },
  { label: '⏰ Trễ',      description: 'Điểm danh muộn',      value: 'tre'             },
  { label: '❌ Vắng',    description: 'Báo vắng mặt',        value: 'khong_tham_gia' },
  { label: '📋 Có phép', description: 'Vắng mặt có lý do',   value: 'co_phep'        },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function pctColor(pct) {
  if (pct >= 80) return COLORS.GREEN;
  if (pct >= 50) return COLORS.ORANGE;
  return COLORS.RED;
}

function pctLabel(pct) {
  if (pct >= 90) return 'Xuất sắc';
  if (pct >= 75) return 'Tốt';
  if (pct >= 50) return 'Trung bình';
  return 'Cần cải thiện';
}

function pctEmoji(pct) {
  if (pct >= 90) return '🏆';
  if (pct >= 80) return '🥇';
  if (pct >= 60) return '🥈';
  if (pct >= 40) return '🥉';
  return '📉';
}

function buildRichProgressBar(pct, len = 12) {
  const filled = Math.round(pct / 100 * len);
  const empty  = len - filled;
  const barFill = pct >= 80 ? '🟩' : pct >= 50 ? '🟨' : pct >= 25 ? '🟧' : '🟥';
  return barFill.repeat(filled) + '⬜'.repeat(empty);
}

const buildProgressBar = buildRichProgressBar;

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}g ${m}p`;
  return `${m}p`;
}

// [#5-D3]
function getEligibleIds(session) {
  return Array.isArray(session.eligible_member_ids) ? session.eligible_member_ids : [];
}

// [#5-D1] Sync
function resolveDisplayName(guild, userId, fallback) {
  if (!guild) return fallback;
  const cache = guild.members?.cache;
  if (!cache || typeof cache.get !== 'function') return fallback;
  const member = cache.get(userId);
  return member ? (member.displayName || member.user.username) : fallback;
}

// [#5-D1] Async
async function resolveDisplayNameAsync(guild, userId, fallback) {
  if (!guild) return fallback;
  try {
    const member = await guild.members.fetch(userId);
    return member ? (member.displayName || member.user.username) : fallback;
  } catch {
    return fallback;
  }
}

function chunkLines(lines, maxLen = 1020) {
  const chunks = [];
  let cur = '';
  for (const line of lines) {
    if ((cur + '\n' + line).length > maxLen) { chunks.push(cur); cur = line; }
    else cur = cur ? cur + '\n' + line : line;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

function buildPhaiStatsText(guild, phaiRoleIds, attended, eligibleArr) {
  if (!phaiRoleIds || !phaiRoleIds.length || !guild) return null;
  const safe = eligibleArr ?? [];
  const eligibleSet = new Set(safe.map ? safe.map(m => m.id ?? m) : []);
  const lines = [];
  for (const roleId of phaiRoleIds) {
    const role = guild.roles?.cache?.get(roleId);
    if (!role) continue;
    const roleMembers = [...role.members.keys()].filter(id => eligibleSet.size === 0 || eligibleSet.has(id));
    const total   = roleMembers.length;
    const present = attended.filter(a =>
      roleMembers.includes(a.user_id) && ['tham_gia', 'tre'].includes(a.status)
    ).length;
    const pct = total > 0 ? Math.round(present / total * 100) : 0;
    const icon = getPhaiIcon(roleId, phaiRoleIds, guild);
    lines.push(`${icon} **${role.name}**: ${present}/${total} (${pct}%)`);
  }
  return lines.length ? lines.join('\n') : null;
}

function buildAuthor(guild) {
  if (!guild) return AUTHOR_DEFAULT;
  const icon = guild.iconURL({ size: 32 });
  return icon ? { name: guild.name, iconURL: icon } : { name: guild.name };
}

// ─── Reply helpers (ephemeral) ──────────────────────────────────────────────────
function replyErr(msg = 'Có lỗi xảy ra. Vui lòng thử lại.') {
  return { embeds: [new EmbedBuilder().setColor(COLORS.RED).setDescription(`❌ ${msg}`)], flags: MessageFlags.Ephemeral };
}
function replyOk(msg = 'Thành công.') {
  return { embeds: [new EmbedBuilder().setColor(COLORS.GREEN).setDescription(`✅ ${msg}`)], flags: MessageFlags.Ephemeral };
}
function replyLoading(msg = 'Đang xử lý...') {
  return { embeds: [new EmbedBuilder().setColor(COLORS.BLUE).setDescription(`⏳ ${msg}`)], flags: MessageFlags.Ephemeral };
}
function replyErrEdit(msg = 'Có lỗi xảy ra. Vui lòng thử lại.') {
  return { embeds: [new EmbedBuilder().setColor(COLORS.RED).setDescription(`❌ ${msg}`)], components: [] };
}
function replyOkEdit(msg = 'Thành công.') {
  return { embeds: [new EmbedBuilder().setColor(COLORS.GREEN).setDescription(`✅ ${msg}`)], components: [] };
}
function replyConfirm(description, yesId, noId) {
  // [FIX] require('./_views/rows') — utils/rows.js không tồn tại
  const { buildConfirmRow } = require('./_views/rows');
  return {
    embeds: [new EmbedBuilder().setColor(COLORS.YELLOW).setDescription(`⚠️ ${description}`).setFooter({ text: FOOTER_DEFAULT })],
    components: [buildConfirmRow(yesId, noId)],
    flags: MessageFlags.Ephemeral,
  };
}

module.exports = {
  COLORS, ICONS, FOOTER_DEFAULT, AUTHOR_DEFAULT, COLOR_GOLD,
  ATTENDANCE_OPTIONS,
  pctColor, pctLabel, pctEmoji,
  buildRichProgressBar, buildProgressBar,
  formatDuration,
  getEligibleIds,
  resolveDisplayName, resolveDisplayNameAsync,
  chunkLines,
  buildPhaiStatsText,
  buildAuthor,
  replyErr, replyOk, replyLoading,
  replyErrEdit, replyOkEdit,
  replyConfirm,
};
