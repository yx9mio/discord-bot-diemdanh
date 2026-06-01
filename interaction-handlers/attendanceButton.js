// interaction-handlers/attendanceButton.js
// Handles: attendance:join, attendance:late, attendance:decline
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

const _pendingLock = new Set();
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

    const sessionQuick = await db.getActiveSession(guild.id);
    if (!sessionQuick) {
      return interaction.reply({ content: '🚫 Không có phiên điểm danh nào đang mở.', ephemeral: true });
    }

    const lockKey = `${sessionQuick.id}:${user.id}`;
    if (_pendingLock.has(lockKey)) {
      return interaction.reply({ content: '⏳ Đang xử lý yêu cầu của bạn, vui lòng chờ...', ephemeral: true });
    }

    _pendingLock.add(lockKey);
    const lockTimer = setTimeout(() => _pendingLock.delete(lockKey), LOCK_MS);

    try {
      await interaction.deferReply({ ephemeral: true });
      const session = sessionQuick;

      if (session.eligible_member_ids && !session.eligible_member_ids.includes(user.id)) {
        return interaction.editReply({ content: '⚠️ Bạn không nằm trong danh sách điểm danh của phiên này.' });
      }

      if (session.allowed_role_id && !member.roles.cache.has(session.allowed_role_id)) {
        const roleName = guild.roles.cache.get(session.allowed_role_id)?.name ?? 'role cần thiết';
        return interaction.editReply({ content: `🔒 Bạn cần có role **${roleName}** để điểm danh.` });
      }

      const username = member.nickname ?? user.displayName ?? user.username;
      await db.upsertAttendance(session.id, guild.id, user.id, username, status, user.id);

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
