'use strict';
const db = require('../../db.js');
const { buildSessionEmbed, buildAttendanceButtons } = require('../../utils/embeds.js');

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

async function handleAttend(interaction) {
  const { customId, guild, member, user } = interaction;
  const status = BUTTON_TO_STATUS[customId];
  if (!status) return false;

  const sessionQuick = await db.getActiveSession(guild.id);
  if (!sessionQuick) {
    await interaction.reply({ content: '🚫 Không có phiên điểm danh nào đang mở.', ephemeral: true });
    return true;
  }

  const lockKey = `${sessionQuick.id}:${user.id}`;
  if (_pendingLock.has(lockKey)) {
    await interaction.reply({ content: '⏳ Đang xử lý yêu cầu của bạn, vui lòng chờ...', ephemeral: true });
    return true;
  }

  _pendingLock.add(lockKey);
  const lockTimer = setTimeout(() => _pendingLock.delete(lockKey), LOCK_MS);

  try {
    await interaction.deferReply({ ephemeral: true });
    const session = sessionQuick;

    if (session.eligible_member_ids && !session.eligible_member_ids.includes(user.id)) {
      await interaction.editReply({ content: '⚠️ Bạn không nằm trong danh sách điểm danh của phiên này.' });
      return true;
    }

    if (session.allowed_role_id) {
      if (!member.roles.cache.has(session.allowed_role_id)) {
        const roleName = guild.roles.cache.get(session.allowed_role_id)?.name ?? 'role cần thiết';
        await interaction.editReply({ content: `🔒 Bạn cần có role **${roleName}** để điểm danh.` });
        return true;
      }
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
    } catch (_err) { /* cập nhật embed thất bại — không ảnh hưởng reply chính */ }

    await interaction.editReply({ content: `${STATUS_LABEL[status]} Đã ghi nhận cho bạn.` });
    return true;
  } finally {
    clearTimeout(lockTimer);
    _pendingLock.delete(lockKey);
  }
}

module.exports = { handleAttend, BUTTON_TO_STATUS };
