'use strict';
// utils/session.js
// Phase 1B fixes:
//   - badge earnedSet null-safe: filter out undefined threshold trước khi đưa vào Set
//   - eligible_member_ids === [] (rỗng): streak reset KHÔNG chạy (đúng semantic)
//     → chỉ reset streak khi eligible có data (admin đã set danh sách)
// [B-3] Migrate từ db.js → services layer
// [FIX-SELECT] voHieuHoaNutDiemDanh: thêm selectRow(false) — disable select menu khi đóng phiên
const { EmbedBuilder } = require('discord.js');
const memberService = require('../services/memberService.js');
const log = require('./logger.js');
const {
  COLORS,
  FOOTER_DEFAULT,
  buildClosedSessionEmbed,
  buildSessionActionRow,
  buildAttendanceSelectRow,
} = require('./embeds.js');

const DEFAULT_BADGES = [
  { threshold:   5, emoji: '🌱', label: 'Lính Mới'     },
  { threshold:  10, emoji: '⭐', label: 'Cần Cù'        },
  { threshold:  20, emoji: '🌟', label: 'Chuyên Cần'    },
  { threshold:  30, emoji: '💪', label: 'Kiên Trì'      },
  { threshold:  50, emoji: '🏆', label: 'Huyền Thoại'   },
  { threshold: 100, emoji: '👑', label: 'Vua Điểm Danh' },
];

async function getBadgeList(guildId) {
  try {
    const rows = await memberService.getBadges(guildId);
    return rows.length ? rows : DEFAULT_BADGES;
  } catch {
    return DEFAULT_BADGES;
  }
}

const PRESENT_STATUSES = new Set(['tham_gia', 'tre']);

/**
 * Kết thúc phiên: cập nhật member_stats, reset streak cho người vắng eligible.
 *
 * Semantic eligible_member_ids:
 *   - null / []  → admin chưa set danh sách → KHÔNG reset streak bất kỳ ai
 *   - [id1, id2] → admin đã set → reset streak người trong list mà vắng
 *
 * @returns {Promise<Map<userId, {total, streak, max}>>}
 */
async function endSession(guild, session, attended) {
  const statsMap = new Map();
  const patchMap = new Map();

  const presentIds = new Set(
    attended.filter(r => PRESENT_STATUSES.has(r.status)).map(r => r.user_id)
  );
  const attendedIds = new Set(attended.map(r => r.user_id));

  const allStats   = await memberService.getAllMemberStats(guild.id);
  const statsCache = new Map(allStats.map(s => [s.user_id, s]));

  function mergePatch(uid, patch) {
    const existing = patchMap.get(uid) ?? {};
    patchMap.set(uid, { ...existing, ...patch, user_id: uid, last_session_id: session.id });
  }

  function getStats(uid) {
    return statsCache.get(uid) ?? {};
  }

  for (const record of attended) {
    if (!PRESENT_STATUSES.has(record.status)) continue;
    const uid   = record.user_id;
    const stats = getStats(uid);
    const total = (stats.total_joined   ?? 0) + 1;
    const streak = (stats.current_streak ?? 0) + 1;
    const maxS   = Math.max(stats.best_streak ?? 0, streak);
    const lat    = (stats.total_late ?? 0) + (record.status === 'tre' ? 1 : 0);
    statsMap.set(uid, { total, streak, max: maxS });
    mergePatch(uid, {
      total_joined:     total,
      current_streak:   streak,
      best_streak:      maxS,
      total_late:       lat,
      total_sessions:   (stats.total_sessions ?? 0) + 1,
      last_attended_at: new Date().toISOString(),
    });
  }

  for (const record of attended) {
    if (PRESENT_STATUSES.has(record.status)) continue;
    const uid   = record.user_id;
    const stats = getStats(uid);
    if (record.status === 'co_phep') {
      mergePatch(uid, {
        total_excused: (stats.total_excused ?? 0) + 1,
        total_sessions: (stats.total_sessions ?? 0) + 1,
      });
    } else if (record.status === 'khong_tham_gia') {
      mergePatch(uid, {
        total_absent:   (stats.total_absent ?? 0) + 1,
        total_sessions: (stats.total_sessions ?? 0) + 1,
      });
    }
  }

  const eligibleIds = session.eligible_member_ids ?? [];
  if (eligibleIds.length > 0) {
    for (const uid of eligibleIds.filter(id => !attendedIds.has(id))) {
      const stats = getStats(uid);
      if (stats.current_streak === 0) {
        mergePatch(uid, { total_sessions: (stats.total_sessions ?? 0) + 1 });
        continue;
      }
      mergePatch(uid, {
        total_joined:     stats.total_joined   ?? 0,
        current_streak:   0,
        best_streak:      stats.best_streak    ?? 0,
        total_absent:     (stats.total_absent  ?? 0) + 1,
        total_late:       stats.total_late     ?? 0,
        total_excused:    stats.total_excused  ?? 0,
        total_sessions:   (stats.total_sessions ?? 0) + 1,
      });
      log.info('SESSION', guild.id, 'Reset streak: %s (vắng %s)', uid, session.session_name);
    }
  }

  const patches = Array.from(patchMap.values());
  if (patches.length) await memberService.batchUpsertMemberStats(guild.id, patches);
  return statsMap;
}

const ketThucPhien = endSession;

const STREAK_MILESTONES = [5, 10, 20, 50];

async function announceStreakMilestone(guild, channel, userId, streak) {
  if (!STREAK_MILESTONES.includes(streak)) return;
  const embed = new EmbedBuilder()
    .setTitle('🔥 Chuỗi điểm danh mới!')
    .setColor(COLORS.ORANGE)
    .setDescription(`<@${userId}> đạt **${streak}** phiên liên tiếp!`)
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();
  await channel.send({ embeds: [embed] }).catch(e => {
    log.warn('STREAK', guild.id, 'announceStreakMilestone lỗi: %s', e.message);
  });
}

const thongBaoStreakMilestone = announceStreakMilestone;

async function announceBadges(guild, channel, guildId, sessionId, attended, statsMap) {
  if (!statsMap || !(statsMap instanceof Map) || !statsMap.size) {
    log.warn('BADGE', guildId, 'announceBadges: statsMap is null/empty, skip');
    return;
  }
  const badges = await getBadgeList(guildId);
  if (!badges.length) return;
  const newBadges = [];

  const userIds = Array.from(statsMap.keys());
  const allUserBadges = await memberService.getMemberBadgesMulti(guildId, userIds);

  for (const [userId, stats] of statsMap.entries()) {
    const existing = allUserBadges[userId] ?? [];
    const earnedSet = new Set(
      existing.map(b => b.threshold).filter(t => t != null)
    );
    for (const badge of badges) {
      if (badge.threshold == null) continue;
      if (stats.total >= badge.threshold && !earnedSet.has(badge.threshold)) {
        try {
          await memberService.upsertMemberBadge(guildId, userId, badge.threshold);
          newBadges.push({ userId, badge });
        } catch (e) {
          log.warn('BADGE', guildId, 'upsertMemberBadge error uid=%s th=%d: %s', userId, badge.threshold, e.message);
        }
      }
    }
  }

  if (!newBadges.length) return;
  const embed = new EmbedBuilder()
    .setTitle('🎖️ Huy Hiệu Mới!')
    .setColor(COLORS.GOLD)
    .setDescription(newBadges.map(({ userId, badge }) =>
      `${badge.emoji} <@${userId}> đạt **${badge.label}** (${badge.threshold} lần điểm danh)`
    ).join('\n'))
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();
  await channel.send({ embeds: [embed] });
}

const thongBaoHuyHieu = announceBadges;

/**
 * Vô hiệu hoá nút điểm danh, cập nhật embed → đã đóng.
 * [FIX] buildSessionActionRow(false) — false = isOpen=false → tất cả nút disabled
 * [FIX-SELECT] buildAttendanceSelectRow(false) — disable select menu khi đóng phiên
 *   Thứ tự rows: selectRow(disabled) → adminRows(disabled) — tối đa 5 rows
 */
async function disableAttendanceUI(client, channel, session, attended = []) {
  if (!session.message_id) return;
  try {
    const msg = await channel.messages.fetch(session.message_id);
    if (!msg) return;
    const closedEmbed  = buildClosedSessionEmbed(session, attended, channel.guild ?? null, session.phai_role_ids ?? null);
    const selectRow    = buildAttendanceSelectRow(false);
    const adminRows    = buildSessionActionRow(false);
    const disabledComponents = [selectRow, ...adminRows].slice(0, 5);
    await msg.edit({ embeds: [closedEmbed], components: disabledComponents });
  } catch (e) {
    log.warn('SESSION', session.guild_id, 'Could not disable UI: %s', e.message);
  }
}

const voHieuHoaNutDiemDanh = disableAttendanceUI;

module.exports = {
  endSession, ketThucPhien,
  announceBadges, thongBaoHuyHieu,
  announceStreakMilestone, thongBaoStreakMilestone,
  disableAttendanceUI, voHieuHoaNutDiemDanh,
  getBadgeList, STREAK_MILESTONES,
};
