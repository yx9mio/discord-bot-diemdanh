// utils/attendanceHandler.js
// [Phase B] Renamed from attendanceService.js → attendanceHandler.js
//           để tránh conflict với services/attendanceService.js (data layer)
// [Phase C] Distributed lock (tryAcquireAttendanceLock) thay thế Set in-memory
'use strict';
const { MessageFlags } = require('discord.js');
const attendanceService = require('../services/attendanceService.js');
const memberService     = require('../services/memberService.js');
const configService     = require('../services/configService.js');
const { metrics }       = require('./metrics.js');
const log               = require('./logger.js');

/**
 * Đánh dấu điểm danh cho một user trong một phiên.
 * @param {object} opts
 * @param {Guild}  opts.guild
 * @param {GuildMember} opts.member
 * @param {User}   opts.user
 * @param {'present'|'absent'} opts.status
 * @param {Interaction} opts.interaction
 * @param {object} opts.session  — session object từ sessionService
 * @param {boolean} [opts.deferred=false] — true nếu interaction đã deferReply
 */
async function markAttendance({ guild, member, user, status, interaction, session, deferred = false }) {
  // [SEC-FIX-2] Validate session thuộc đúng guild — ngăn cross-guild data injection
  if (session.guild_id !== guild.id) {
    log.warn('SECURITY', guild.id, 'markAttendance: guild mismatch session.guild_id=%s guild.id=%s user=%s', session.guild_id, guild.id, user.id);
    const msg = '❌ Phiên không hợp lệ.';
    return deferred
      ? interaction.editReply({ content: msg })
      : interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
  }

  // [A2] Distributed lock thay vì in-memory Map
  const acquired = await attendanceService.tryAcquireAttendanceLock(session.id, user.id);
  if (!acquired) {
    const msg = '⏳ Đang xử lý điểm danh của bạn, vui lòng đợi.';
    return deferred
      ? interaction.editReply({ content: msg })
      : interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
  }

  try {
    // ── Kiểm tra role bắt buộc ────────────────────────────────────────────────
    const cfg = await configService.getGuildConfig(guild.id);
    if (cfg?.required_role_id) {
      const hasRole = member?.roles?.cache?.has(cfg.required_role_id);
      if (!hasRole) {
        const msg = `❌ Bạn cần có role <@&${cfg.required_role_id}> để điểm danh.`;
        return deferred
          ? interaction.editReply({ content: msg })
          : interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
      }
    }

    // ── Kiểm tra trùng điểm danh ─────────────────────────────────────────────
    const existing = await attendanceService.getAttendance(session.id, user.id);
    if (existing) {
      const msg = '✅ Bạn đã điểm danh rồi.';
      return deferred
        ? interaction.editReply({ content: msg })
        : interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
    }

    // ── Upsert điểm danh ──────────────────────────────────────────────────────
    await attendanceService.upsertAttendance({
      session_id:    session.id,
      guild_id:      guild.id,
      user_id:       user.id,
      display_name:  member?.displayName ?? user.username,
      status,
    });

    // ── Cập nhật streak ───────────────────────────────────────────────────────
    let streakMsg = '';
    try {
      const stats = await memberService.updateStreak(guild.id, user.id, status);
      if (stats?.current_streak > 1) {
        streakMsg = ` 🔥 Streak: **${stats.current_streak}**`;
      }
    } catch (streakErr) {
      log.warn('STREAK', guild.id, 'updateStreak lỗi user=%s: %s', user.id, streakErr?.message);
    }

    // ── Metric ────────────────────────────────────────────────────────────────
    metrics.attendanceMarked(guild.id, status, { markedBy: 'self' });

    const statusLabel = status === 'present' ? '✅ Điểm danh thành công!' : '❌ Vắng mặt đã được ghi nhận.';
    const msg = `${statusLabel}${streakMsg}`;
    return deferred
      ? interaction.editReply({ content: msg })
      : interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });

  } catch (e) {
    log.error('ATTENDANCE', guild.id, 'markAttendance lỗi: %s', e?.message ?? e);
    const msg = '⚠️ Đã có lỗi xảy ra khi ghi điểm danh. Vui lòng thử lại.';
    return deferred
      ? interaction.editReply({ content: msg })
      : interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
  } finally {
    await attendanceService.releaseAttendanceLock(session.id, user.id).catch(() => {});
  }
}

module.exports = { markAttendance };
