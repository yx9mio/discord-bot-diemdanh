// utils/attendanceService.js
// [A4] Shared attendance logic cho cả slash command và SelectMenu
'use strict';
const db = require('../db.js');
const {
  buildSessionEmbed,
  buildSessionActionRow,
  buildAttendConfirmEmbed,
} = require('./embeds.js');

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
    return interaction.reply({ content: msg, ephemeral: true });
  }

  try {
    if (!deferred) {
      await interaction.deferReply({ ephemeral: true });
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

    // Fetch streak (best-effort)
    let streak;
    try {
      streak = await db.getStreak?.(guild.id, user.id);
    } catch (_) {}

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

    // Return confirm embed
    const confirmEmbed = buildAttendConfirmEmbed(
      member,
      status,
      session.session_name ?? 'Phiên điểm danh',
      streak
    );
    return interaction.editReply(confirmEmbed);
  } finally {
    await db.releaseAttendanceLock(session.id, user.id);
  }
}

module.exports = { markAttendance };
