// interaction-handlers/attendanceSelect.js
// Handles: attendance:select (StringSelectMenu cho điểm danh)
// [B1] Thay thế button bằng select menu
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const db = require('../db.js');
const {
  buildSessionEmbed,
  buildSessionActionRow,
  buildAttendConfirmEmbed,
} = require('../utils/embeds.js');

const SELECT_TO_STATUS = {
  'tham_gia':       'tham_gia',
  'tre':            'tre',
  'khong_tham_gia': 'khong_tham_gia',
  'co_phep':        'co_phep',
};

class AttendanceSelectHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.StringSelect });
  }

  parse(interaction) {
    if (interaction.customId === 'attendance:select') return this.some();
    return this.none();
  }

  async run(interaction) {
    const { customId, guild, member, user, values } = interaction;
    const statusValue = values[0]; // Select menu chỉ chọn 1 giá trị
    const status = SELECT_TO_STATUS[statusValue];

    const session = await db.getActiveSession(guild.id);
    if (!session) {
      return interaction.reply({ content: '🚫 Không có phiên điểm danh nào đang mở.', ephemeral: true });
    }

    // [A2] Distributed lock thay vì in-memory Map
    const acquired = await db.tryAcquireAttendanceLock(session.id, user.id);
    if (!acquired) {
      return interaction.reply({ content: '⏳ Đang xử lý yêu cầu của bạn, vui lòng chờ...', ephemeral: true });
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      if (session.eligible_member_ids?.length && !session.eligible_member_ids.includes(user.id)) {
        return interaction.editReply({ content: '⚠️ Bạn không nằm trong danh sách điểm danh của phiên này.' });
      }

      if (session.allowed_role_id && !member.roles.cache.has(session.allowed_role_id)) {
        const roleName = guild.roles.cache.get(session.allowed_role_id)?.name ?? 'role cần thiết';
        return interaction.editReply({ content: `🔒 Bạn cần có role **${roleName}** để điểm danh.` });
      }

      const username = member.nickname ?? user.displayName ?? user.username;

      await db.upsertAttendance({
        session_id:    session.id,
        guild_id:      guild.id,
        user_id:       user.id,
        username,
        status,
        marked_by:     user.id,
        checked_in_at: new Date().toISOString(),
      });

      let streak;
      try {
        streak = await db.getStreak?.(guild.id, user.id);
      } catch (_) {}

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

      const confirmEmbed = buildAttendConfirmEmbed(
        member,
        status,
        session.name ?? 'Phiên điểm danh',
        streak
      );
      return interaction.editReply(confirmEmbed);
    } finally {
      await db.releaseAttendanceLock(session.id, user.id);
    }
  }
}

module.exports = { AttendanceSelectHandler };
