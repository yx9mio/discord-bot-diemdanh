'use strict';
// utils/session.js
// Phase 1B fixes:
//   - badge earnedSet null-safe: filter out undefined threshold trước khi đưa vào Set
//   - eligible_member_ids === [] (rỗng): streak reset KHÔNG chạy (đúng semantic)
//     → chỉ reset streak khi eligible có data (admin đã set danh sách)
// [B-3] Migrate từ db.js → services layer
const { EmbedBuilder } = require('discord.js');
const memberService = require('../services/memberService.js');
const log = require('./logger.js');
const { FOOTER_DEFAULT, buildAttendanceButtons, buildClosedSessionEmbed, buildSessionActionRow } = require('./embeds.js');

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
async function ketThucPhien(guild, session, attended) {
  const statsMap = new Map();
  const patchMap = new Map();

  const presentIds = new Set(
    attended.filter(r => PRESENT_STATUSES.has(r.status)).map(r => r.user_id)
  );

  const allStats   = await memberService.getAllMemberStats(guild.id);
  const statsCache = new Map(allStats.map(s => [s.user_id, s]));

  // Helper: gộp patch cho 1 user (tránh duplicate entry ghi đè nhau)
  function mergePatch(uid, patch) {
    const existing = patchMap.get(uid) ?? {};
    patchMap.set(uid, { ...existing, ...patch, user_id: uid, last_session_id: session.id });
  }

  // Helper: lấy stats an toàn
  function getStats(uid) {
    return statsCache.get(uid) ?? {};
  }

  // 1. Cập nhật stats cho người có mặt
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
      total_joined:   total,
      current_streak: streak,
      best_streak:    maxS,
      total_late:     lat,
      total_sessions: (stats.total_sessions ?? 0) + 1,
    });
  }

  // 2. Cập nhật absent/excused cho người không có mặt
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

  // 3. Reset streak cho người eligible mà vắng — CHỈ khi eligible có data
  const eligibleIds = session.eligible_member_ids ?? [];
  if (eligibleIds.length > 0) {
    for (const uid of eligibleIds.filter(id => !presentIds.has(id))) {
      const stats = getStats(uid);
      if (stats.current_streak === 0) {
        // Vẫn tăng total_sessions cho eligible ngay cả khi streak = 0
        mergePatch(uid, { total_sessions: (stats.total_sessions ?? 0) + 1 });
        continue;
      }
      mergePatch(uid, {
        total_joined:     stats.total_joined   ?? 0,
        current_streak:   0,
        best_streak:      stats.best_streak    ?? 0,
        total_sessions:   (stats.total_sessions ?? 0) + 1,
      });
      log.info('SESSION', guild.id, 'Reset streak: %s (vắng %s)', uid, session.session_name);
    }
  }

  const patches = Array.from(patchMap.values());
  if (patches.length) await memberService.batchUpsertMemberStats(guild.id, patches);
  return statsMap;
}

/**
 * Thông báo huy hiệu mới.
 * Phase 1B fix: earnedSet null-safe — filter undefined threshold trước khi Set
 * Optimized: Sử dụng batch queries thay vì sequential calls trong loop
 */
const STREAK_MILESTONES = [5, 10, 20, 50]; // [C2]

/**
 * Thông báo milestone streak trong channel phiên (best-effort).
 */
async function thongBaoStreakMilestone(guild, channel, userId, streak) {
  if (!STREAK_MILESTONES.includes(streak)) return;
  const embed = new EmbedBuilder()
    .setTitle('🔥 Chuỗi điểm danh mới!')
    .setColor(0xe67e22)
    .setDescription(`<@${userId}> đạt **${streak}** phiên liên tiếp!`)
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();
  await channel.send({ embeds: [embed] }).catch(e => {
    log.warn('STREAK', guild.id, 'thongBaoStreakMilestone lỗi: %s', e.message);
  });
}

async function thongBaoHuyHieu(guild, channel, guildId, sessionId, attended, statsMap) {
  if (!statsMap || !(statsMap instanceof Map) || !statsMap.size) {
    log.warn('BADGE', guildId, 'thongBaoHuyHieu: statsMap is null/empty, bỏ qua');
    return;
  }
  const badges = await getBadgeList(guildId);
  if (!badges.length) return;
  const newBadges = [];

  // Batch fetch all user badges at once instead of sequential calls
  const userIds = Array.from(statsMap.keys());
  const allUserBadges = await memberService.getMemberBadgesMulti(guildId, userIds);

  for (const [userId, stats] of statsMap.entries()) {
    const existing = allUserBadges[userId] ?? [];
    // Fix null-safe: bỏ qua row có threshold undefined/null
    const earnedSet = new Set(
      existing.map(b => b.threshold).filter(t => t != null)
    );
    for (const badge of badges) {
      if (badge.threshold == null) continue; // skip badge definition lỗi
      if (stats.total >= badge.threshold && !earnedSet.has(badge.threshold)) {
        try {
          await memberService.upsertMemberBadge(guildId, userId, badge.threshold);
          newBadges.push({ userId, badge });
        } catch (e) {
          log.warn('BADGE', guildId, 'upsertMemberBadge lỗi uid=%s th=%d: %s', userId, badge.threshold, e.message);
        }
      }
    }
  }

  if (!newBadges.length) return;
  const embed = new EmbedBuilder()
    .setTitle('🎖️ Huy Hiệu Mới!')
    .setColor(0xd19900)
    .setDescription(newBadges.map(({ userId, badge }) =>
      `${badge.emoji} <@${userId}> đạt **${badge.label}** (${badge.threshold} lần điểm danh)`
    ).join('\n'))
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();
  await channel.send({ embeds: [embed] });
}

/**
 * Vô hiệu hoá nút điểm danh, cập nhật embed → đã đóng.
 * [#10] Fix: dùng buildSessionActionRow(true) thay vì buildAttendanceButtons(true)
 *       để disabled đủ tất cả 3 ActionRow (dropdown + admin buttons + đóng phiên).
 */
async function voHieuHoaNutDiemDanh(client, channel, session, attended = []) {
  if (!session.message_id) return;
  try {
    const msg = await channel.messages.fetch(session.message_id);
    if (!msg) return;
    const closedEmbed      = await buildClosedSessionEmbed(session, attended, channel.guild ?? null);
    const disabledComponents = buildSessionActionRow(true); // [#10] đủ 3 rows, tất cả disabled
    await msg.edit({ embeds: [closedEmbed], components: disabledComponents });
  } catch (e) {
    log.warn('SESSION', session.guild_id, 'Không vô hiệu hoá được nút: %s', e.message);
  }
}

/** Gửi file CSV điểm danh đính kèm vào channel. */
async function guiCsvDinhKem(channel, session, attended) {
  try {
    const lines = [
      'user_id,username,status,time',
      ...attended.map(a =>
        [a.user_id, (a.username ?? '').replace(/,/g, ' '), a.status, a.checked_in_at ?? a.created_at ?? ''].join(',')
      ),
    ];
    const buf  = Buffer.from(lines.join('\n'), 'utf-8');
    const ts   = new Date().toISOString().slice(0, 10);
    const name = `diemdanh-${(session.session_name ?? session.id.slice(0, 8)).replace(/[^a-z0-9]/gi, '_')}-${ts}.csv`;
    await channel.send({
      content: `📎 Báo cáo điểm danh: **${session.session_name}**`,
      files:   [{ attachment: buf, name }],
    });
  } catch (e) {
    log.warn('SESSION', session.guild_id, 'guiCsvDinhKem lỗi: %s', e.message);
  }
}

module.exports = {
  ketThucPhien, thongBaoHuyHieu, thongBaoStreakMilestone, voHieuHoaNutDiemDanh,
  getBadgeList, guiCsvDinhKem, STREAK_MILESTONES,
};
