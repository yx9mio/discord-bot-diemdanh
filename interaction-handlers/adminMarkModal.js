// interaction-handlers/adminMarkModal.js
// [B3] Modal cho admin điểm danh thay cho member khác
'use strict';
const {
  InteractionHandler, InteractionHandlerTypes,
} = require('@sapphire/framework');
const db = require('../db.js');
const log = require('../utils/logger.js');
const { requireAdmin } = require('../utils/permissions.js');

const STATUS_LABELS = {
  'tham_gia': '✅ Điểm danh',
  'tre': '⏰ Trễ',
  'khong_tham_gia': '❌ Không tham gia',
  'co_phep': '🏥 Có phép',
};

class AdminMarkModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId === 'admin:mark:modal') return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const { guild, user } = interaction;
    const { ok } = await requireAdmin(interaction, { context: 'điểm danh thay' });
    if (!ok) return;

    const session = await db.getActiveSession(guild.id);
    if (!session) {
      return interaction.editReply({ content: '🚫 Không có phiên điểm danh nào đang mở.' });
    }

    const userField = interaction.fields.getTextInputValue('user_id').trim();
    const statusField = interaction.fields.getTextInputValue('status').trim().toLowerCase();

    const validStatuses = ['tham_gia', 'tre', 'khong_tham_gia', 'co_phep'];
    if (!validStatuses.includes(statusField)) {
      return interaction.editReply({
        content: `❌ Trạng thái không hợp lệ. Vui lòng dùng: ${validStatuses.join(', ')}`,
      });
    }
    const status = statusField;

    let targetUserId, targetMember;
    if (userField.startsWith('<@') && userField.endsWith('>')) {
      targetUserId = userField.slice(2, -1).replace('!', '');
    } else {
      targetUserId = userField;
    }

    try {
      targetMember = await guild.members.fetch(targetUserId);
    } catch {
      try {
        targetMember = await guild.members.fetch(targetUserId);
      } catch {
        return interaction.editReply({ content: `❌ Không tìm thấy user với ID: ${targetUserId}` });
      }
    }

    if (targetMember.user.bot) {
      return interaction.editReply({ content: '❌ Không thể điểm danh cho bot.' });
    }

    const username = targetMember.nickname ?? targetMember.displayName ?? targetMember.user.username;

    try {
      await db.upsertAttendance({
        session_id:    session.id,
        guild_id:      guild.id,
        user_id:       targetUserId,
        username,
        status,
        marked_by:     user.id,
        checked_in_at: new Date().toISOString(),
      });
    } catch (e) {
      log.error('ADMIN_MARK', guild.id, 'upsertAttendance thất bại: %s', e.message);
      return interaction.editReply({ content: '❌ Không thể lưu điểm danh, thử lại sau.' });
    }

    log.info('ADMIN_MARK', guild.id, '%s điểm danh thay cho %s: %s', user.tag, targetUserId, status);
    return interaction.editReply({
      content: `✅ Đã điểm danh thay cho **${username}** (${STATUS_LABELS[status]})`,
    });
  }
}

module.exports = { AdminMarkModalHandler };
