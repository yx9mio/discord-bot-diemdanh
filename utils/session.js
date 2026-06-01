// utils/session.js
// M-1: thongBaoHuyHieu dùng db.getBadges() thay vì hardcode
// Fix B-5: ketThucPhien reset current_streak = 0 cho thành viên vắng mặt
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

// Các status được tính là "có mặt" để cộng streak
const PRESENT_STATUSES = new Set(['tham_gia', 'tre']);

/**
 * Kết thúc phiên: cập nhật member_stats và trả về statsMap.
 * Fix B-5: reset current_streak = 0 cho thành viên vắng mặt (không có trong PRESENT_STATUSES).
 * @returns {Promise<Map<userId, {total, streak, max}>>}
 */
async function ketThucPhien(guild, session, attended) {
  const statsMap = new Map();
  const patches  = [];

  // Tập hợp những người CÓ MẶT trong phiên này
  const presentIds = new Set(
    attended.filter(r => PRESENT_STATUSES.has(r.status)).map(r => r.user_id)
  );

  // ── Cộng streak cho người có mặt ─────────────────────────────────────────
  for (const record of attended) {
    if (!PRESENT_STATUSES.has(record.status)) continue;
    const uid   = record.user_id;
    const stats = await db.getMemberStats(guild.id, uid)
      ?? { total_joined: 0, current_streak: 0, max_streak: 0 };

    const total  = (stats.total_joined   ?? 0) + 1;
    const streak = (stats.current_streak ?? 0) + 1;
    const maxS   = Math.max(stats.max_streak ?? 0, streak);

    statsMap.set(uid, { total, streak, max: maxS });
    patches.push({
      user_id: uid,
      total_joined: total,
      current_streak: streak,
      max_streak: maxS,
      last_session_id: session.id,
    });
  }

  // ── Fix B-5: Reset streak = 0 cho thành viên eligible vắng mặt ──────────
  // Chỉ reset những người trong eligible_member_ids (nếu có) mà không có mặt
  const eligibleIds = session.eligible_member_ids ?? [];
  const absentIds = eligibleIds.filter(id => !presentIds.has(id));

  for (const uid of absentIds) {
    const stats = await db.getMemberStats(guild.id, uid);
    if (!stats || stats.current_streak === 0) continue; // không cần reset nếu đã = 0
    patches.push({
      user_id: uid,
      total_joined: stats.total_joined ?? 0,  // không thay đổi tổng
      current_streak: 0,                       // reset streak
      max_streak: stats.max_streak ?? 0,       // giữ nguyên max
      last_session_id: session.id,
    });
    log.info('SESSION', guild.id, 'Reset streak cho %s (vắng phiên %s)', uid, session.session_name);
  }

  if (patches.length) await db.batchUpsertMemberStats(guild.id, patches);
  return statsMap;
}

/**
 * Thông báo huy hiệu mới cho thành viên đạt mốc.
 * M-1: dùng db.getBadges() thay vì hardcode BADGE_THRESHOLDS.
 * Signature: (guild, channel, guildId, sessionId, attended, statsMap)
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
 */
async function voHieuHoaNutDiemDanh(client, channel, session, attended = []) {
  if (!session.message_id) return;
  try {
    const msg = await channel.messages.fetch(session.message_id);
    if (!msg) return;

    const closedEmbed     = buildClosedSessionEmbed(session, attended, channel.guild ?? null);
    const disabledButtons = buildAttendanceButtons(true);

    await msg.edit({ embeds: [closedEmbed], components: [disabledButtons] });
  } catch (e) {
    log.warn('SESSION', session.guild_id, 'Không vô hiệu hoá được nút: %s', e.message);
  }
}

/**
 * guiCsvDinhKem — Gửi file CSV điểm danh đính kèm vào channel.
 */
async function guiCsvDinhKem(channel, session, attended) {
  try {
    const lines = [
      'user_id,display_name,status,time',
      ...attended.map(a =>
        [a.user_id, (a.display_name ?? '').replace(/,/g, ' '), a.status, a.created_at ?? a.time ?? ''].join(',')
      ),
    ];
    const buf  = Buffer.from(lines.join('\n'), 'utf-8');
    const ts   = new Date().toISOString().slice(0, 10);
    const name = `diemdanh-${(session.session_name ?? session.id.slice(0, 8)).replace(/[^a-z0-9]/gi, '_')}-${ts}.csv`;
    await channel.send({
      content: `📎 Báo cáo điểm danh: **${session.session_name}**`,
      files: [{ attachment: buf, name }],
    });
  } catch (e) {
    log.warn('SESSION', session.guild_id, 'guiCsvDinhKem lỗi: %s', e.message);
  }
}

module.exports = { ketThucPhien, thongBaoHuyHieu, voHieuHoaNutDiemDanh, getBadgeList, guiCsvDinhKem };
