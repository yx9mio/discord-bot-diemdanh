// utils/session.js
// M-1: thongBaoHuyHieu dùng db.getBadges() thay vì hardcode
'use strict';
const { EmbedBuilder }     = require('discord.js');
const db                   = require('../db.js');
const log                  = require('./logger.js');
const { FOOTER_DEFAULT, buildSummaryEmbed, buildAttendanceButtons, buildClosedSessionEmbed } = require('./embeds.js');

// ── Huy hiệu mặc định nếu DB chưa có row nào ─────────────────────────────────
const DEFAULT_BADGES = [
  { threshold:   5, emoji: '🌱', label: 'Lính Mới'       },
  { threshold:  10, emoji: '⭐', label: 'Cần Cù'          },
  { threshold:  20, emoji: '🌟', label: 'Chuyên Cần'      },
  { threshold:  30, emoji: '💪', label: 'Kiên Trì'        },
  { threshold:  50, emoji: '🏆', label: 'Huyền Thoại'     },
  { threshold: 100, emoji: '👑', label: 'Vua Điểm Danh'   },
];

/**
 * Lấy danh sách badge cho guild (từ DB, fallback DEFAULT_BADGES).
 * @param {string} guildId
 * @returns {Promise<Array<{threshold, emoji, label}>>}
 */
async function getBadgeList(guildId) {
  try {
    const rows = await db.getBadges(guildId);
    return rows.length ? rows : DEFAULT_BADGES;
  } catch {
    return DEFAULT_BADGES;
  }
}

// Các status được tính là "có mặt" để cộng điểm danh
const PRESENT_STATUSES = new Set(['tham_gia', 'tre']);

/**
 * Kết thúc phiên: cập nhật member_stats và trả về statsMap.
 * @returns {Promise<Map<userId, {total, streak, max}>>}
 */
async function ketThucPhien(guild, session, attended) {
  const statsMap = new Map();
  const patches  = [];

  for (const record of attended) {
    if (!PRESENT_STATUSES.has(record.status)) continue;
    const uid   = record.user_id;
    const gid   = guild.id;
    const stats = await db.getMemberStats(gid, uid) ?? { total_joined: 0, current_streak: 0, max_streak: 0 };

    const total  = (stats.total_joined   ?? 0) + 1;
    const streak = (stats.current_streak ?? 0) + 1;
    const maxS   = Math.max(stats.max_streak ?? 0, streak);

    statsMap.set(uid, { total, streak, max: maxS });
    patches.push({ user_id: uid, total_joined: total, current_streak: streak, max_streak: maxS, last_session_id: session.id });
  }

  if (patches.length) await db.batchUpsertMemberStats(guild.id, patches);
  return statsMap;
}

/**
 * Thông báo huy hiệu mới cho thành viên đạt mốc.
 * M-1: dùng db.getBadges() thay vì hardcode BADGE_THRESHOLDS.
 */
async function thongBaoHuyHieu(guild, channel, guildId, sessionId, attended, statsMap) {
  const badges = await getBadgeList(guildId);
  if (!badges.length) return;

  const newBadges = [];

  for (const [userId, stats] of statsMap.entries()) {
    const existing = await db.getMemberBadges(guildId, userId);
    const earnedSet = new Set(existing.map(b => b.threshold));

    for (const badge of badges) {
      if (stats.total >= badge.threshold && !earnedSet.has(badge.threshold)) {
        await db.upsertMemberBadge(guildId, userId, badge.threshold);
        newBadges.push({ userId, badge });
      }
    }
  }

  if (!newBadges.length) return;

  const lines = newBadges.map(({ userId, badge }) =>
    `${badge.emoji} <@${userId}> đạt **${badge.label}** (${badge.threshold} lần điểm danh)`
  ).join('\n');

  const embed = new EmbedBuilder()
    .setTitle('🎖️ Huy Hiệu Mới!')
    .setColor(0xd19900)
    .setDescription(lines)
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  await channel.send({ embeds: [embed] });
}

/**
 * Phase I: Vô hiệu hoá nút điểm danh trên message cũ VÀ cập nhật embed → 🔴 Đã Đóng.
 * Fix K: truyền guild vào buildClosedSessionEmbed để render danh sách.
 */
async function voHieuHoaNutDiemDanh(client, channel, session, attended = []) {
  if (!session.message_id) return;
  try {
    const msg = await channel.messages.fetch(session.message_id);
    if (!msg) return;

    // Fix K: pass guild cho buildClosedSessionEmbed
    const closedEmbed   = buildClosedSessionEmbed(session, attended, channel.guild ?? null);
    const disabledButtons = buildAttendanceButtons(true);

    await msg.edit({ embeds: [closedEmbed], components: [disabledButtons] });
  } catch (e) {
    log.warn('SESSION', session.guild_id, 'Không vô hiệu hoá được nút: %s', e.message);
  }
}

module.exports = { ketThucPhien, thongBaoHuyHieu, voHieuHoaNutDiemDanh, getBadgeList };
