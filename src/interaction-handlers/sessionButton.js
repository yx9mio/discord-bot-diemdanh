// interaction-handlers/sessionButton.js
// Handles: nút trên embed phiên (điểm danh/làm mới/đóng/confirm/cancel)
// [FIX-SELECT] attend_view pagination + attend_refresh: thêm buildAttendanceSelectRow(true)
//   để select menu không bị mất sau khi paginate hoặc refresh
'use strict';
const { MessageFlags, AttachmentBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const sessionService = require('../../services/sessionService.js');
const attendanceService = require('../../services/attendanceService.js');
const log = require('../../utils/logger.js');
const metrics = require('../../utils/metrics.js');
const { buildCsvBuffer, buildCsvFilename } = require('../../utils/csvHelper.js');
const { requireAdmin } = require('../../utils/permissions.js');
const {
  buildSessionEmbed, buildSummaryEmbed,
  buildSessionActionRow, buildAttendanceSelectRow,
  replyErr, replyErrEdit, replyOkEdit, replyConfirm,
} = require('../../utils/embeds.js');
const { endSession, announceBadges, disableAttendanceUI } = require('../../utils/session.js');
const { cancelTimers, stopAutoRefresh } = require('../../utils/timers.js');
const { buildAdminMarkModal } = require('../../utils/adminMarkModal.js');

// [BUG-FIX] Đồng bộ với tất cả customId được dùng trong file này
const SESSION_BUTTON_IDS = new Set([
  'attend_view', 'attend_close', 'attend_refresh', 'admin:mark',
  'attend_view:prev', 'attend_view:next',
  'session:export_csv',
  'session:cancel', 'session:confirm_cancel', 'session:cancel_cancel',
  'session:confirm_close', 'session:cancel_close',
  'session:confirm_close:all', 'session:cancel_close:all',
]);

class SessionButtonHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    // Prefix match cho attend_view:prev / attend_view:next
    if (SESSION_BUTTON_IDS.has(interaction.customId)) return this.some();
    if (interaction.customId.startsWith('attend_view:')) return this.some();
    return this.none();
  }

  async run(interaction) {
    const { customId, guild } = interaction;

    // ── attend_view / attend_view:prev / attend_view:next ────────────────────────
    if (customId === 'attend_view' || customId.startsWith('attend_view:')) {
      const session = await sessionService.getActiveSession(guild.id);
      if (!session) {
        if (customId.startsWith('attend_view:')) {
          await interaction.deferUpdate();
          return interaction.editReply({ content: '🚫 Phiên đã kết thúc.', embeds: [], components: [] });
        }
        return interaction.reply({ content: '🚫 Không có phiên điểm danh nào đang mở.', flags: MessageFlags.Ephemeral });
      }
      const attended = await attendanceService.getAttendances(session.id);

      if (customId.startsWith('attend_view:')) {
        await interaction.deferUpdate();
        const parts = customId.split(':');
        const action = parts[1];
        const currentPage = parseInt(parts[2], 10) || 1;

        const totalPages = Math.max(1, Math.ceil(attended.length / 15));
        const page = action === 'prev'
          ? Math.max(1, currentPage - 1)
          : Math.min(totalPages, currentPage + 1);

        const { embed, components: pagComponents } =
          buildSessionEmbed(guild, session, attended, session.phai_role_ids ?? [], false, page);

        // [FIX-SELECT] Giữ select menu sau pagination
        const selectRow = buildAttendanceSelectRow(true);
        const adminRows = buildSessionActionRow(true);
        return interaction.editReply({
          embeds: [embed],
          components: [selectRow, ...adminRows, ...pagComponents].slice(0, 5),
        });
      }

      const { embed, components } =
        buildSessionEmbed(guild, session, attended, session.phai_role_ids ?? [], false, 1);
      return interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
    }

    // ── attend_refresh ────────────────────────────────────────────────────────────
    if (customId === 'attend_refresh') {
      await interaction.deferUpdate();
      try {
        const session = await sessionService.getActiveSession(interaction.guildId);
        if (!session) return interaction.followUp({ ...replyErr('Không có phiên điểm danh đang mở.'), flags: MessageFlags.Ephemeral });
        const attended = await attendanceService.getAttendances(session.id);
        await interaction.guild.members.fetch().catch(() => {});
        const { embed, components: pagComponents } =
          buildSessionEmbed(interaction.guild, session, attended, session.phai_role_ids ?? [], false);
        // [FIX-SELECT] Giữ select menu sau refresh
        const selectRow = buildAttendanceSelectRow(true);
        const adminRows = buildSessionActionRow(true);
        await interaction.editReply({
          embeds: [embed],
          components: [selectRow, ...adminRows, ...pagComponents].slice(0, 5),
        });
        log.info('REFRESH', interaction.guildId, '%s làm mới embed điểm danh', interaction.user.tag);
      } catch (e) {
        log.error('REFRESH', interaction.guildId, 'Lỗi handleRefresh: %s', e.message);
        await interaction.followUp({ ...replyErr('Không thể làm mới, thử lại sau.'), flags: MessageFlags.Ephemeral });
      }
      return;
    }

    // ── admin:mark ─────────────────────────────────────────────────────────────────
    if (customId === 'admin:mark') {
      const { ok } = await requireAdmin(interaction, { context: 'điểm danh thay' });
      if (!ok) return;
      return interaction.showModal(buildAdminMarkModal());
    }

    // ── session:cancel ──────────────────────────────────────────────────────────
    if (customId === 'session:cancel') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { ok } = await requireAdmin(interaction, { context: 'hủy phiên', deferred: true });
      if (!ok) return;
      const session = await sessionService.getActiveSession(guild.id);
      if (!session) return interaction.editReply(replyErrEdit('🚫 Không có phiên nào đang mở.'));
      return interaction.editReply(
        replyConfirm(
          `Bạn có chắc muốn **HỦY** phiên **"${session.session_name}"**?\n> Hành động này sẽ hủy phiên và giữ nguyên tất cả điểm danh đã ghi.`,
          'session:confirm_cancel',
          'session:cancel_cancel',
        ),
      );
    }

    // ── session:confirm_cancel ───────────────────────────────────────────────────
    if (customId === 'session:confirm_cancel') {
      const { channel } = interaction;
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      // [SEC-FIX-1] Re-validate admin
      const { ok: okCancel } = await requireAdmin(interaction, { context: 'xác nhận hủy phiên', deferred: true });
      if (!okCancel) return;
      const session = await sessionService.getActiveSession(guild.id);
      if (!session) return interaction.editReply(replyErrEdit('🚫 Phiên đã được đóng hoặc hủy trước đó.'));

      try {
        stopAutoRefresh(session.id);
        await sessionService.cancelSession(session.id);
        cancelTimers(guild.id);
      } catch (e) {
        log.error('CANCEL', guild.id, 'cancelSession thất bại %s: %s', session.id, e.message);
        const stillActive = await sessionService.getActiveSession(guild.id).catch(() => null);
        if (!stillActive) {
          return interaction.editReply(replyOkEdit('✅ Phiên đã được hủy bởi người khác.'));
        }
        return interaction.editReply(replyErrEdit('❌ Không thể hủy phiên do lỗi DB, thử lại sau.'));
      }

      metrics.sessionClosed(guild.id, { cancelled: true });

      const attended = await attendanceService.getAttendances(session.id);
      await Promise.allSettled([
        interaction.editReply(replyOkEdit('✅ Phiên điểm danh đã được hủy thành công.')),
        disableAttendanceUI(interaction.client, channel, session, attended),
      ]);
    }

    // ── session:cancel_cancel ───────────────────────────────────────────────────
    if (customId === 'session:cancel_cancel') {
      return interaction.update({ content: '↩️ Đã hủy. Phiên vẫn đang mở.', embeds: [], components: [] });
    }

    // ── session:export_csv ───────────────────────────────────────────────────────
    if (customId === 'session:export_csv') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { ok } = await requireAdmin(interaction, { context: 'xuất CSV', deferred: true });
      if (!ok) return;
      const session = await sessionService.getActiveSession(guild.id);
      if (!session) return interaction.editReply(replyErrEdit('🚫 Không có phiên nào đang mở.'));

      const attended = await attendanceService.getAttendances(session.id);
      if (!attended.length) return interaction.editReply(replyErrEdit('🚫 Chưa có ai điểm danh trong phiên này.'));

      try {
        const csvBuffer = buildCsvBuffer(attended);
        const filename = buildCsvFilename(session.session_name ?? session.id, session.id);
        const attachment = new AttachmentBuilder(csvBuffer, { name: filename });
        return interaction.editReply({
          content: `📄 File CSV điểm danh phiên **${session.session_name}** (${attended.length} bản ghi)`,
          files: [attachment],
        });
      } catch (e) {
        log.error('EXPORT_CSV', guild.id, 'Lỗi tạo CSV: %s', e.message);
        return interaction.editReply(replyErrEdit('❌ Không thể tạo file CSV, thử lại sau.'));
      }
    }

    // ── attend_close ─────────────────────────────────────────────────────────────
    if (customId === 'attend_close') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { ok } = await requireAdmin(interaction, { context: 'đóng phiên', deferred: true });
      if (!ok) return;
      const session = await sessionService.getActiveSession(guild.id);
      if (!session) return interaction.editReply(replyErrEdit('🚫 Không có phiên nào đang mở.'));
      return interaction.editReply(
        replyConfirm(
          `Bạn có chắc muốn đóng phiên **"${session.session_name}"**?\n> Hành động này không thể hoàn tác.`,
          'session:confirm_close',
          'session:cancel_close',
        ),
      );
    }

    // ── session:confirm_close ───────────────────────────────────────────────────
    if (customId === 'session:confirm_close') {
      const { channel } = interaction;
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      // [SEC-FIX-1] Re-validate admin
      const { ok: okClose } = await requireAdmin(interaction, { context: 'xác nhận đóng phiên', deferred: true });
      if (!okClose) return;
      const session = await sessionService.getActiveSession(guild.id);
      if (!session) return interaction.editReply(replyErrEdit('🚫 Phiên đã được đóng trước đó.'));

      try {
        stopAutoRefresh(session.id);
        await sessionService.closeSession(session.id);
        cancelTimers(guild.id);
      } catch (e) {
        log.error('CLOSE', guild.id, 'closeSession thất bại %s: %s', session.id, e.message);
        const stillActive = await sessionService.getActiveSession(guild.id).catch(() => null);
        if (!stillActive) {
          return interaction.editReply(replyOkEdit('✅ Phiên đã được đóng bởi người khác.'));
        }
        return interaction.editReply(replyErrEdit('❌ Không thể đóng phiên do lỗi DB, thử lại sau.'));
      }

      // Auto-mark khong_tham_gia cho eligible members chưa điểm danh
      const eligibleIds = session.eligible_member_ids ?? [];
      if (eligibleIds.length > 0) {
        try {
          const existingRecords = await attendanceService.getAttendances(session.id);
          const existingUserIds = new Set(existingRecords.map(r => r.user_id));
          const absentIds = eligibleIds.filter(uid => !existingUserIds.has(uid));
          if (absentIds.length > 0) {
            await guild.members.fetch().catch(() => {});
            const absentRows = absentIds.map(uid => {
              const member = guild.members.cache.get(uid);
              return {
                user_id:  uid,
                username: member?.user?.username ?? member?.displayName ?? uid,
              };
            });
            await attendanceService.bulkInsertAbsent(session.id, guild.id, absentRows);
            log.info('CLOSE', guild.id, 'Auto-mark khong_tham_gia: %d thành viên (%s)',
              absentIds.length, absentIds.join(', '));
          }
        } catch (e) {
          log.warn('CLOSE', guild.id, 'bulkInsertAbsent thất bại (non-fatal): %s', e.message);
        }
      }

      const attended = await attendanceService.getAttendances(session.id);
      const [settledEndSession] = await Promise.allSettled([
        endSession(guild, session, attended),
        disableAttendanceUI(interaction.client, channel, session, attended),
      ]);
      const statsMap = settledEndSession.status === 'fulfilled' ? settledEndSession.value : null;

      metrics.sessionClosed(guild.id, { cancelled: false });
      metrics.sessionMemberCount(guild.id, attended.length);

      await channel.send({ embeds: [await buildSummaryEmbed(session, attended, guild, session.phai_role_ids ?? [])] }).catch(() => null);
      await announceBadges(guild, channel, guild.id, session.id, attended, statsMap).catch(() => null);
      return interaction.editReply(replyOkEdit('✅ Phiên điểm danh đã được đóng thành công.'));
    }

    // ── session:cancel_close ────────────────────────────────────────────────────
    if (customId === 'session:cancel_close') {
      return interaction.update({ content: '↩️ Đã hủy. Phiên vẫn đang mở.', embeds: [], components: [] });
    }

    // ── session:confirm_close:all (batch) ───────────────────────────────────────
    if (customId === 'session:confirm_close:all') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { ok: okBatch } = await requireAdmin(interaction, { context: 'đóng tất cả phiên', deferred: true });
      if (!okBatch) return;

      const sessions = await sessionService.getActiveSessions(guild.id);
      if (!sessions.length) return interaction.editReply(replyErrEdit('Không có phiên nào để đóng.'));

      let closed = 0;
      for (const s of sessions) {
        try {
          stopAutoRefresh(s.id);
          cancelTimers(guild.id);
          await sessionService.closeSession(s.id);
          closed++;
        } catch (e) {
          log.warn('CLOSE_ALL', guild.id, 'Đóng phiên %s thất bại: %s', s.id, e.message);
        }
      }

      log.info('CLOSE_ALL', guild.id, 'Đã đóng %d/%d phiên', closed, sessions.length);
      return interaction.editReply(replyOkEdit(`Đã đóng **${closed}/${sessions.length}** phiên đang mở.`));
    }

    // ── session:cancel_close:all (batch) ─────────────────────────────────────────
    if (customId === 'session:cancel_close:all') {
      return interaction.update({ content: '↩️ Đã hủy. Các phiên vẫn đang mở.', embeds: [], components: [] });
    }
  }
}

module.exports = { SessionButtonHandler };
