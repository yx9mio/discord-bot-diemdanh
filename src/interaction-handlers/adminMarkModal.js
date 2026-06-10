// interaction-handlers/adminMarkModal.js
// [B3] Modal cho admin điểm danh thay cho member khác
// [BUG-E] Guard role mention <@&...> để tránh fetch member với role ID
'use strict';
const { MessageFlags } = require('discord.js');
const {
  InteractionHandler, InteractionHandlerTypes,
} = require('@sapphire/framework');
const { getActiveSession } = require('../../services/sessionService.js');
const { upsertAttendance } = require('../../services/attendanceService.js');
const log = require('../../utils/logger.js');
const metrics = require('../../utils/metrics.js');
const { requireAdmin } = require('../../utils/permissions.js');
const { addBreadcrumb } = require('../../utils/sentry.js');

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
    addBreadcrumb('interaction', 'adminMarkModal', {
      customId: interaction.customId,
      userId: interaction.user?.id,
    });
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const { guild, user } = interaction;
    const { ok } = await requireAdmin(interaction, { context: 'điểm danh thay', deferred: true });
    if (!ok) return;

    const session = await getActiveSession(guild.id);
    if (!session) {
      return interaction.editReply({ content: '🚫 Không có phiên điểm danh nào đang mở.' });
    }

    // [BUG-12] Defensive assert — lớp bảo vệ thứ hai bổ sung cho getActiveSession
    if (session.guild_id !== guild.id) {
      log.warn('ADMIN_MARK', guild.id, 'SECURITY: session.guild_id=%s !== guild.id=%s user=%s', session.guild_id, guild.id, user.id);
      return interaction.editReply({ content: '❌ Phiên không hợp lệ.' });
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

    // [BUG-E] Guard: từ chối role mention <@&roleId>
    if (userField.startsWith('<@&')) {
      return interaction.editReply({ content: '❌ Vui lòng mention user (không phải role), hoặc nhập thẳng User ID.' });
    }

    let targetUserId;
    if (userField.startsWith('<@') && userField.endsWith('>')) {
      targetUserId = userField.slice(2, -1).replace('!', '');
    } else {
      targetUserId = userField;
    }

    let targetMember;
    try {
      targetMember = await guild.members.fetch(targetUserId);
    } catch {
      return interaction.editReply({ content: `❌ Không tìm thấy user với ID: ${targetUserId}` });
    }

    if (targetMember.user.bot) {
      return interaction.editReply({ content: '❌ Không thể điểm danh cho bot.' });
    }

    const username = targetMember.nickname ?? targetMember.user.displayName ?? targetMember.user.username;

    try {
      await upsertAttendance({
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

    metrics.attendanceMarked(guild.id, status, { markedBy: 'admin' });
    log.info('ADMIN_MARK', guild.id, '%s điểm danh thay cho %s: %s', user.tag, targetUserId, status);
    return interaction.editReply({
      content: `✅ Đã điểm danh thay cho **${username}** (${STATUS_LABELS[status]})`,
    });
  }
}

module.exports = { AdminMarkModalHandler };
