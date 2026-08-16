// src/interaction-handlers/attendanceConfirm.js
// Handles: attendance:confirm:<sid>:<status> (✅ Xác nhận) và attendance:change (↩️ Đổi trạng thái)
// [UX-P2] Bước 2 của flow điểm danh: ghi nhận sau khi user xác nhận.
//   - ✅: ghi DB → edit phiếu tại chỗ (edit-in-place, không gửi tin mới)
//   - ↩️: quay lại phiếu để chọn trạng thái khác
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const sessionService    = require('../../services/sessionService.js');
const attendanceService = require('../../services/attendanceService.js');
const log               = require('../../utils/logger.js');
const { replyErrEdit, renderAttendancePanel } = require('../../utils/embeds.js');
const { STATUS_CONFIG } = require('../../utils/design-tokens.js');
const { checkCooldown } = require('../../utils/cooldown.js');
const { wrapHandler } = require('../../utils/error-boundary.js');

const CHANGE_ID = 'attendance:change';
const CONFIRM_PREFIX = 'attendance:confirm:';

class AttendanceConfirmHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (interaction.customId === CHANGE_ID || interaction.customId?.startsWith(CONFIRM_PREFIX)) return this.some();
    return this.none();
  }

  async run(interaction) {
    return wrapHandler(async (interaction) => {
    const { guild, user, customId } = interaction;

    // ── attendance:change — quay lại phiếu, chọn trạng thái khác ──────────────
    if (customId === CHANGE_ID) {
      await interaction.deferUpdate();
      const session = await sessionService.getActiveSession(guild.id);
      if (!session) {
        return interaction.editReply({ content: '🚫 Kỳ đã kết thúc.', embeds: [], components: [] });
      }
      const { embed, components } = await renderAttendancePanel(guild, session, { userId: user.id });
      return interaction.editReply({ embeds: [embed], components });
    }

    // ── attendance:confirm:<sid>:<status> — ghi nhận điểm danh ─────────────────
    await interaction.deferUpdate();
    const parts = customId.split(':');
    const sid = parts[2];
    const status = parts[3];

    const session = await sessionService.getSessionById(sid).catch(() => null);
    if (!session || session.guild_id !== guild.id) {
      return interaction.editReply(replyErrEdit('Không tìm thấy Kỳ điểm danh.'));
    }
    if (!session.is_active) {
      return interaction.editReply(replyErrEdit('Kỳ điểm danh đã kết thúc.'));
    }

    if (!checkCooldown(user.id, 'attendance', 2000)) {
      return interaction.editReply({ content: '⏳ Bạn đang thao tác quá nhanh, vui lòng chậm lại...', embeds: [], components: [] });
    }

    const acquired = await attendanceService.tryAcquireAttendanceLock(session.id, user.id);
    if (!acquired) {
      return interaction.editReply({ content: '⏳ Đang xử lý điểm danh của bạn, vui lòng chờ...', embeds: [], components: [] });
    }

    try {
      const memberData = await guild.members.fetch(user.id).catch(() => null);

      // upsertAttendance dùng snake_case, idempotent (onConflict update)
      await attendanceService.upsertAttendance({
        session_id:    session.id,
        user_id:       user.id,
        guild_id:      guild.id,
        status,
        username:      memberData?.nickname ?? user.displayName ?? user.username,
        marked_by:     user.id,
        checked_in_at: new Date().toISOString(),
      });

      const sc = STATUS_CONFIG[status];
      const label = sc ? `${sc.emoji} ${sc.label}` : `❓ ${status}`;
      log.info('ATTEND_CONFIRM', guild.id, '%s điểm danh: %s', user.tag, status);

      // [UX-P2] Edit phiếu tại chỗ: hiện trạng thái mới + dòng 'Hiện tại' — không gửi tin mới
      const { embed, components } = await renderAttendancePanel(guild, session, { userId: user.id });
      return interaction.editReply({
        content: `✅ Đã ghi nhận: **${label}** — Kỳ **"${session.session_name}"**.`,
        embeds: [embed],
        components,
      });
    } catch (e) {
      log.error('ATTEND_CONFIRM', guild.id, 'Lỗi upsertAttendance: %s', e.message);
      return interaction.editReply(replyErrEdit('❌ Không thể ghi nhận điểm danh, thử lại sau.'));
    } finally {
      await attendanceService.releaseAttendanceLock(session.id, user.id).catch(() => {});
    }
  }, 'AttendanceConfirmHandler')(interaction); }
}

module.exports = { AttendanceConfirmHandler };