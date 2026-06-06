// utils/attendanceHandler.js
// [Phase B] Renamed from attendanceService.js → attendanceHandler.js
//           để tránh conflict với services/attendanceService.js (data layer)
// [A4] Shared attendance logic cho cả slash command và SelectMenu
// [B-3] Migrate từ db.js → services layer
// [FIX-SELECT] Rebuild select menu khi update embed — tránh select menu bị mất
// [BUG-LOCK] tryAcquireAttendanceLock / releaseAttendanceLock đã sync (không cần await)
'use strict';
const { MessageFlags } = require('discord.js');
const log = require('./logger.js');
const attendanceService = require('../services/attendanceService.js');
const memberService     = require('../services/memberService.js');
const configService     = require('../services/configService.js');
const metrics = require('./metrics.js');
const {
  buildSessionEmbed,
  buildSessionActionRow,
  buildAttendanceSelectRow,
  buildAttendConfirmEmbed,
} = require('./embeds.js');
const { thongBaoStreakMilestone, STREAK_MILESTONES } = require('./session.js');

/**
 * Shared attendance logic - tái dùng cho cả slash command và SelectMenu
 * @param {Object} params
 * @param {import('discord.js').Guild} params.guild
 * @param {import('discord.js').GuildMember} params.member
 * @param {import('discord.js').User} params.user
 * @param {string} params.status - 'tham_gia' | 'tre' | 'khong_tham_gia' | 'co_phep'
 * @param {import('discord.js').BaseInteraction} params.interaction
 * @param {Object} params.session - Session object from sessionService.getActiveSession
 * @param {boolean} params.deferred - true nếu interaction đã defer
 */
async function markAttendance({ guild, member, user, status, interaction, session, deferred = false }) {
  // [SEC-FIX-2] Validate session thuộc đúng guild — ngăn cross-guild session injection
  if (session.guild_id !== guild.id) {
    log.warn('SECURITY', guild.id, 'markAttendance: guild mismatch session.guild_id=%s guild.id=%s user=%s', session.guild_id, guild.id, user.id);
    const msg = '❌ Phiên không hợp lệ.';
    return deferred
      ? interaction.editReply({ content: msg })
      : interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
  }

  // [BUG-LOCK] sync lock — không cần await
  const acquired = attendanceService.tryAcquireAttendanceLock(session.id, user.id);
  if (!acquired) {
    const msg = '⏳ Đang xử lý yêu cầu của bạn, vui lòng chờ...';
    return deferred
      ? interaction.editReply({ content: msg })
      : interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
  }

  try {
    if (!deferred) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    // Validate eligible_member_ids
    if (session.eligible_member_ids?.length && !session.eligible_member_ids.includes(user.id)) {
      return interaction.editReply({ content: '⚠️ Bạn không nằm trong danh sách điểm danh của phiên này.' });
    }

    // Validate allowed_role_id
    if (session.allowed_role_id && !member.roles.cache.has(session.allowed_role_id)) {
      const roleName = guild.roles.cache.get(session.allowed_role_id)?.name ?? 'role cần thiết';
      return interaction.editReply({ content: `🔒 Bạn cần có role **${roleName}** để điểm danh.` });
    }

    // Validate attendance_role_id từ guild config
    try {
      const cfg = await configService.getGuildConfig(guild.id);
      if (cfg?.attendance_role_id && !member.roles.cache.has(cfg.attendance_role_id)) {
        const roleName = guild.roles.cache.get(cfg.attendance_role_id)?.name ?? 'role điểm danh';
        return interaction.editReply({ content: `🔒 Bạn cần có role **${roleName}** để điểm danh.` });
      }
    } catch (_) { /* fallthrough */ }

    const username = member.nickname ?? user.displayName ?? user.username;

    await attendanceService.upsertAttendance({
      session_id:    session.id,
      guild_id:      guild.id,
      user_id:       user.id,
      username,
      status,
      marked_by:     user.id,
      checked_in_at: new Date().toISOString(),
    });

    metrics.attendanceMarked(guild.id, status, { markedBy: 'self' });

    let streak = 0;
    let projectedStreak = 0;
    try {
      const stats = await memberService.getMemberStats(guild.id, user.id);
      streak = stats?.current_streak ?? 0;
      projectedStreak = ['tham_gia', 'tre'].includes(status) ? streak + 1 : streak;
    } catch (_) {}

    // Cập nhật embed chính
    try {
      const ch = guild.channels.cache.get(session.channel_id);
      if (ch && session.message_id) {
        const msg = await ch.messages.fetch(session.message_id).catch(() => null);
        if (msg) {
          const attended = await attendanceService.getAttendances(session.id);
          const { embed, components: pagComponents } = buildSessionEmbed(
            guild, session, attended, session.phai_role_ids ?? []
          );
          const selectRow  = buildAttendanceSelectRow(true);
          const adminRows  = buildSessionActionRow(true);
          await msg.edit({
            embeds: [embed],
            components: [selectRow, ...adminRows, ...pagComponents].slice(0, 5),
          }).catch(() => null);
        }
      }
    } catch (_) {}

    if (STREAK_MILESTONES.includes(projectedStreak) && ['tham_gia', 'tre'].includes(status)) {
      try {
        const ch = guild.channels.cache.get(session.channel_id);
        if (ch) await thongBaoStreakMilestone(guild, ch, user.id, projectedStreak);
      } catch (_) {}
    }

    const displayStreak = ['tham_gia', 'tre'].includes(status) ? projectedStreak : streak;
    return interaction.editReply(buildAttendConfirmEmbed(
      member, status, session.session_name ?? 'Phiên điểm danh', displayStreak
    ));
  } catch (e) {
    log.error('ATTENDANCE', guild.id, 'markAttendance lỗi: %s', e?.message ?? e);
    const errMsg = { content: '❌ Có lỗi xảy ra khi điểm danh, thử lại sau.' };
    if (deferred || interaction.replied) {
      await interaction.editReply(errMsg).catch(() => null);
    } else {
      await interaction.reply({ ...errMsg, flags: MessageFlags.Ephemeral }).catch(() => null);
    }
  } finally {
    // [BUG-LOCK] sync release — không cần await
    attendanceService.releaseAttendanceLock(session.id, user.id);
  }
}

module.exports = { markAttendance };
