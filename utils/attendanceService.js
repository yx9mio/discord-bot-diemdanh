// utils/attendanceService.js
// [A4] Shared attendance logic cho cả slash command và SelectMenu
'use strict';
const { MessageFlags } = require('discord.js');
const log = require('../utils/logger.js');
const db = require('../db.js');
const {
  buildSessionEmbed,
  buildSessionActionRow,
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
 * @param {Object} params.session - Session object from db.getActiveSession
 * @param {boolean} params.deferred - true nếu interaction đã defer
 */
async function markAttendance({ guild, member, user, status, interaction, session, deferred = false }) {
  // [A2] Distributed lock thay vì in-memory Map
  const acquired = await db.tryAcquireAttendanceLock(session.id, user.id);
  if (!acquired) {
    const msg = '⏳ Đang xử lý yêu cầu của bạn, vui lòng chờ...';
    if (deferred) {
      return interaction.editReply({ content: msg });
    }
    return interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
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
      const cfg = await db.getGuildConfig(guild.id);
      if (cfg?.attendance_role_id && !member.roles.cache.has(cfg.attendance_role_id)) {
        const roleName = guild.roles.cache.get(cfg.attendance_role_id)?.name ?? 'role điểm danh';
        return interaction.editReply({ content: `🔒 Bạn cần có role **${roleName}** để điểm danh.` });
      }
    } catch (_) { /* fallthrough */ }

    const username = member.nickname ?? user.displayName ?? user.username;

    // Upsert attendance với full payload
    await db.upsertAttendance({
      session_id:    session.id,
      guild_id:      guild.id,
      user_id:       user.id,
      username,
      status,
      marked_by:     user.id,
      checked_in_at: new Date().toISOString(),
    });

    // [C2] Fetch streak from member_stats (best-effort)
    let streak = 0;
    let projectedStreak = 0;
    try {
      const stats = await db.getMemberStats(guild.id, user.id);
      streak = stats?.current_streak ?? 0;
      projectedStreak = ['tham_gia', 'tre'].includes(status) ? streak + 1 : streak;
    } catch (_) {
      streak = 0;
      projectedStreak = 0;
    }

    // Cập nhật embed chính
    try {
      const ch = guild.channels.cache.get(session.channel_id);
      if (ch && session.message_id) {
        const msg = await ch.messages.fetch(session.message_id).catch(() => null);
        if (msg) {
          const attended = await db.getAttendances(session.id);
          const { embed } = await buildSessionEmbed(
            guild,
            session,
            attended,
            session.phai_role_ids ?? []
          );
          await msg.edit({
            embeds: [embed],
            components: buildSessionActionRow(false),
          }).catch(() => null);
        }
      }
    } catch (_) {}

    // [C2] Streak milestone notification (projected streak sau phiên hiện tại)
    if (STREAK_MILESTONES.includes(projectedStreak) && ['tham_gia', 'tre'].includes(status)) {
      try {
        const ch = guild.channels.cache.get(session.channel_id);
        if (ch) await thongBaoStreakMilestone(guild, ch, user.id, projectedStreak);
      } catch (_) {}
    }

    // Return confirm embed — hiển thị projected streak khi tham gia/trễ
    const displayStreak = ['tham_gia', 'tre'].includes(status) ? projectedStreak : streak;
    const confirmEmbed = buildAttendConfirmEmbed(
      member,
      status,
      session.session_name ?? 'Phiên điểm danh',
      displayStreak
    );
    return interaction.editReply(confirmEmbed);
  } catch (e) {
    log.error('ATTENDANCE', guild.id, 'markAttendance lỗi: %s', e?.message ?? e);
    if (deferred || interaction.replied) {
      await interaction.editReply({ content: '❌ Lỗi xử lý điểm danh, vui lòng thử lại.' }).catch(() => null);
    } else {
      await interaction.reply({ content: '❌ Lỗi xử lý điểm danh, vui lòng thử lại.', flags: MessageFlags.Ephemeral }).catch(() => null);
    }
  } finally {
    await db.releaseAttendanceLock(session.id, user.id);
  }
}

module.exports = { markAttendance };
