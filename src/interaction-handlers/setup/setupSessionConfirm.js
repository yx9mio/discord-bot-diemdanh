'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { MessageFlags } = require('discord.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { replyOkEdit, replyErrEdit } = require('../../../utils/embeds.js');
const sessionService = require('../../../services/sessionService.js');
const attendanceService = require('../../../services/attendanceService.js');
const { endSession, announceBadges, disableAttendanceUI } = require('../../../utils/session.js');
const { stopAutoRefresh } = require('../../../utils/timers.js');
const { auditLog } = require('../../../services/auditLogService.js');
const metrics = require('../../../utils/metrics.js');
const log = require('../../../utils/logger.js');
const { wrapHandler } = require('../../../utils/error-boundary.js');

const PREFIX_CLOSE = 'setup:session:confirm:close:';
const PREFIX_CANCEL = 'setup:session:confirm:cancel:';
const CLOSE_ALL = 'setup:session:confirm:close:all';

class SetupSessionConfirmHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === CLOSE_ALL) return this.some();
    if (id.startsWith(PREFIX_CLOSE)) return this.some();
    if (id.startsWith(PREFIX_CANCEL)) return this.some();
    if (['setup:session:cancel_close', 'setup:session:cancel_close:all',
         'setup:session:cancel_cancel'].includes(id)) return this.some();
    return this.none();
  }

  async run(interaction) {
    return wrapHandler(async (interaction) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { ok } = await requireAdmin(interaction, { context: 'quản lý phiên', deferred: true });
    if (!ok) return;

    const { customId, guild } = interaction;

    // ── Hủy thao tác xác nhận ─────────────────────────────────────────────────
    if (['setup:session:cancel_close', 'setup:session:cancel_close:all',
         'setup:session:cancel_cancel'].includes(customId)) {
      return interaction.editReply({ content: 'Đã hủy thao tác.' });
    }

    try {
      if (customId === CLOSE_ALL) {
        const sessions = await sessionService.getActiveSessions(guild.id);
        if (!sessions || sessions.length === 0) {
          return interaction.editReply(replyErrEdit('Không có Kỳ điểm danh nào đang mở.'));
        }

        let closedCount = 0;
        for (const s of sessions) {
          try {
            stopAutoRefresh(s.id);
            await sessionService.closeSession(s.id, guild.id);
            const attended = await attendanceService.getAttendances(s.id);
            const statsMap = await endSession(guild, s, attended);
            const ch = s.channel_id ? await guild.channels.fetch(s.channel_id).catch(() => null) : interaction.channel;
            if (ch) {
              await disableAttendanceUI(interaction.client, ch, s, attended).catch(() => null);
              await announceBadges(guild, ch, guild.id, s.id, attended, statsMap).catch(() => null);
            }
            closedCount++;
          } catch (e) {
            log.error('CLOSE_ALL', guild.id, 'Lỗi đóng phiên %s: %s', s.id, e.message);
          }
        }

        auditLog({ guildId: guild.id, actorId: interaction.user.id, action: 'SESSION_CLOSE_ALL', metadata: { count: closedCount } }).catch(() => {});
        log.info('CLOSE_ALL', guild.id, 'Admin %s đã đóng %d phiên', interaction.user.tag, closedCount);
        return interaction.editReply(replyOkEdit(`✅ Đã đóng thành công **${closedCount}/${sessions.length}** Kỳ điểm danh.`));
      }

      if (customId.startsWith(PREFIX_CANCEL)) {
        const sessionId = customId.slice(PREFIX_CANCEL.length);
        const session = await sessionService.getSessionByIdRaw(sessionId, guild.id);
        if (!session) return interaction.editReply(replyErrEdit('Không tìm thấy Bang Chiến yêu cầu.'));
        if (session.status !== 'open') {
          return interaction.editReply(replyErrEdit(`Bang Chiến **"${session.session_name}"** không còn mở.`));
        }

        stopAutoRefresh(session.id);
        await sessionService.cancelSession(session.id, guild.id);
        auditLog({ guildId: guild.id, actorId: interaction.user.id, action: 'SESSION_CANCEL', metadata: { sessionId: session.id } }).catch(() => {});

        const ch = session.channel_id ? await guild.channels.fetch(session.channel_id).catch(() => null) : interaction.channel;
        if (ch) {
          await disableAttendanceUI(interaction.client, ch, session, []).catch(() => null);
        }

        log.info('SESSION_CANCEL', guild.id, 'Admin %s đã hủy phiên %s', interaction.user.tag, session.session_name);
        metrics.sessionClosed(guild.id, { cancelled: true });
        return interaction.editReply(replyOkEdit('🗑️ Bang Chiến đã được hủy thành công.'));
      }

      if (customId.startsWith(PREFIX_CLOSE)) {
        const sessionId = customId.slice(PREFIX_CLOSE.length);
        const session = await sessionService.getSessionByIdRaw(sessionId, guild.id);
        if (!session) return interaction.editReply(replyErrEdit('Không tìm thấy Bang Chiến yêu cầu.'));
        if (session.status !== 'open') {
          return interaction.editReply(replyErrEdit(`Bang Chiến **"${session.session_name}"** không còn mở.`));
        }

        // 1. Tắt auto-refresh
        stopAutoRefresh(session.id);

        // 2. Cập nhật DB: đóng session
        await sessionService.closeSession(session.id, guild.id);
        auditLog({ guildId: guild.id, actorId: interaction.user.id, action: 'SESSION_CLOSE', metadata: { sessionId: session.id } }).catch(() => {});

        // 3. Lấy danh sách điểm danh và tính stats
        const attended = await attendanceService.getAttendances(session.id);
        const statsMap = await endSession(guild, session, attended);

        // 4. Cập nhật embed trong channel: disable UI
        // [FIX] Dùng session.channel_id — admin có thể thao tác từ /setup
        const channel = session.channel_id ? await guild.channels.fetch(session.channel_id).catch(() => null) : interaction.channel;
        if (channel) {
          await disableAttendanceUI(interaction.client, channel, session, attended).catch(() => null);
        }

        log.info('SESSION_CLOSE', guild.id, 'Admin %s đã đóng phiên %s (%d người)', interaction.user.tag, session.session_name, attended.length);
        metrics.sessionClosed(guild.id, { cancelled: false });
        metrics.sessionMemberCount(guild.id, attended.length);

        if (channel) {
          await announceBadges(guild, channel, guild.id, session.id, attended, statsMap).catch(() => null);
        }
        return interaction.editReply(replyOkEdit('✅ Bang Chiến đã được đóng thành công.'));
      }

      return interaction.editReply(replyErrEdit('Hành động không hợp lệ.'));
    } catch (e) {
      log.error('SESSION_CONFIRM', guild.id, 'Thực thi thất bại: %s', e.message);
      return interaction.editReply(replyErrEdit('Không thể thực hiện hành động, thử lại sau.'));
    }
  }, 'SetupSessionConfirmHandler')(interaction); }
}

module.exports = { SetupSessionConfirmHandler };