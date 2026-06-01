// interaction-handlers/attendanceButton.js
// Handles: attendance:join, attendance:late, attendance:decline
// BUG-1 fix: upsertAttendance gọi đúng signature object payload
// BUG-6 fix: lock scope chặt hơn, không để race condition khi reply throw
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const db = require('../db.js');
const { buildSessionEmbed, buildAttendanceButtons } = require('../utils/embeds.js');

const BUTTON_TO_STATUS = {
  'attendance:join':    'tham_gia',
  'attendance:late':   'tre',
  'attendance:decline':'khong_tham_gia',
};

const STATUS_LABEL = {
  tham_gia:       '✅ Tham Gia',
  tre:            '⏰ Đến Trễ',
  khong_tham_gia: '❌ Vắng Mặt',
};

// BUG-6: Map thay Set để lưu promise, tránh race condition
const _pendingLock = new Map();
const LOCK_MS = 5_000;

class AttendanceButtonHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (BUTTON_TO_STATUS[interaction.customId]) return this.some();
    return this.none();
  }

  async run(interaction) {
    const { customId, guild, member, user } = interaction;
    const status = BUTTON_TO_STATUS[customId];

    const session = await db.getActiveSession(guild.id);
    if (!session) {
      return interaction.reply({ content: '🚫 Không có phiên điểm danh nào đang mở.', ephemeral: true });
    }

    // BUG-6 fix: kiểm tra lock trước deferReply, xóa lock chỉ sau khi xong
    const lockKey = `${session.id}:${user.id}`;
    if (_pendingLock.has(lockKey)) {
      return interaction.reply({ content: '⏳ Đang xử lý yêu cầu của bạn, vui lòng chờ...', ephemeral: true });
    }
    _pendingLock.set(lockKey, Date.now());
    const lockTimer = setTimeout(() => _pendingLock.delete(lockKey), LOCK_MS);

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

      // BUG-1 fix: dùng object payload thay vì positional args
      await db.upsertAttendance({
        session_id:   session.id,
        guild_id:     guild.id,
        user_id:      user.id,
        username,
        status,
        marked_by:    user.id,
        checked_in_at: new Date().toISOString(),
      });

      // Cập nhật embed chính (best-effort, không throw nếu lỗi)
      try {
        const ch = guild.channels.cache.get(session.channel_id);
        if (ch && session.message_id) {
          const msg = await ch.messages.fetch(session.message_id).catch(() => null);
          if (msg) {
            const attended = await db.getAttendances(session.id);
            const embed    = await buildSessionEmbed(guild, session, attended);
            await msg.edit({ embeds: [embed], components: [buildAttendanceButtons(false)] }).catch(() => null);
          }
        }
      } catch (_) {}

      return interaction.editReply({ content: `${STATUS_LABEL[status]} Đã ghi nhận cho bạn.` });
    } finally {
      clearTimeout(lockTimer);
      _pendingLock.delete(lockKey);
    }
  }
}

module.exports = { AttendanceButtonHandler };
