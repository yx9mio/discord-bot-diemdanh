// interaction-handlers/sessionButton.js
// Handles: nút trên embed phiên (điểm danh/làm mới/đóng/confirm/cancel)
// [FIX-SELECT] attend_view pagination + attend_refresh: thêm buildAttendanceSelectRow(true)
//   để select menu không bị mất sau khi paginate hoặc refresh
'use strict';
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const sessionService = require('../../services/sessionService.js');
const attendanceService = require('../../services/attendanceService.js');
const log = require('../../utils/logger.js');
const metrics = require('../../utils/metrics.js');
const { requireAdmin } = require('../../utils/permissions.js');
const configService = require('../../services/configService.js');
const {
  buildSessionEmbed, buildSummaryEmbed,
  buildSessionActionRow, buildAttendanceSelectRow,
  replyErr, replyErrEdit, replyOkEdit, replyConfirm,
} = require('../../utils/embeds.js');
const { endSession, announceBadges, disableAttendanceUI } = require('../../utils/session.js');
const { cancelTimers, stopAutoRefresh } = require('../../utils/timers.js');
const { buildAdminMarkModal } = require('../../utils/adminMarkModal.js');
const { buildAdminEditModal } = require('../../utils/adminEditModal.js');
const { wrapHandler } = require('../../utils/error-boundary.js');
const { auditLog } = require('../../utils/auditLog.js');
const { checkCooldown } = require('../../utils/cooldown.js');

// [BUG-FIX] Đồng bộ với tất cả customId được dùng trong file này
const SESSION_BUTTON_IDS = new Set([
  'attend_view', 'attend_close', 'attend_refresh', 'admin:mark', 'admin:edit',
  'attend_view:prev', 'attend_view:next',
  'session:cancel', 'session:confirm_cancel', 'session:cancel_cancel',
  'session:confirm_close', 'session:cancel_close',
  'session:confirm_close:all', 'session:cancel_close:all',
]);

async function _phaiData(session, guildId) {
  const cfg = await configService.getGuildConfig(guildId).catch(() => null);
  const phaiRoleIds = session.phai_role_ids?.length ? session.phai_role_ids : cfg?.phai_role_ids ?? [];
  return { phaiRoleIds, emojiMap: cfg?.phai_role_icons ?? null };
}

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
    return wrapHandler(async (interaction) => {
    const { customId, guild } = interaction;

    // ── attend_view / attend_view:prev / attend_view:next ────────────────────────
    if (customId === 'attend_view' || customId.startsWith('attend_view:')) {
      const session = await sessionService.getActiveSession(guild.id);
      if (!session) {
        if (customId.startsWith('attend_view:')) {
          await interaction.deferUpdate();
          return interaction.editReply({ content: '🚫 Kỳ đã kết thúc.', embeds: [], components: [] });
        }
        return interaction.reply({ content: '🚫 Không có Kỳ điểm danh nào đang mở.', flags: MessageFlags.Ephemeral });
      }
      const attended = await attendanceService.getAttendances(session.id);

      if (customId.startsWith('attend_view:')) {
        await interaction.deferUpdate();
        if (!checkCooldown(interaction.user.id, 'session_view', 1000)) return;
        const parts = customId.split(':');
        const action = parts[1];
        const currentPage = parseInt(parts[2], 10) || 1;

        const totalPages = Math.max(1, Math.ceil(attended.length / 15));
        const page = action === 'prev'
          ? Math.max(1, currentPage - 1)
          : Math.min(totalPages, currentPage + 1);

        const { phaiRoleIds: phaiIds1, emojiMap: emojiMap1 } = await _phaiData(session, guild.id);
        const { embed, components: pagComponents } =
          buildSessionEmbed(guild, session, attended, phaiIds1, false, page, emojiMap1);

        // [FIX-SELECT] Giữ select menu sau pagination
        const selectRow = buildAttendanceSelectRow(true);
        const adminRows = buildSessionActionRow(true);
        return interaction.editReply({
          embeds: [embed],
          components: [selectRow, ...adminRows, ...pagComponents].slice(0, 5),
        });
      }

      const { phaiRoleIds: phaiIds2, emojiMap: emojiMap2 } = await _phaiData(session, guild.id);
      const { embed, components } =
        buildSessionEmbed(guild, session, attended, phaiIds2, false, 1, emojiMap2);
      return interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
    }

    // ── attend_refresh ────────────────────────────────────────────────────────────
    if (customId === 'attend_refresh') {
      await interaction.deferUpdate();
      if (!checkCooldown(interaction.user.id, 'session_refresh', 1000)) return;
      try {
        const session = await sessionService.getActiveSession(interaction.guildId);
        if (!session) return interaction.followUp({ ...replyErr('Không có Kỳ điểm danh đang mở.'), flags: MessageFlags.Ephemeral });
        const attended = await attendanceService.getAttendances(session.id);
        await interaction.guild.members.fetch().catch(() => {});
        const { phaiRoleIds: phaiIds3, emojiMap: emojiMap3 } = await _phaiData(session, interaction.guild.id);
        const { embed, components: pagComponents } =
          buildSessionEmbed(interaction.guild, session, attended, phaiIds3, false, 1, emojiMap3);
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
      if (!checkCooldown(interaction.user.id, 'admin_mark', 5000)) {
        return interaction.reply({ content: '⏳ Vui lòng đợi trước khi thực hiện lại thao tác này.', flags: MessageFlags.Ephemeral });
      }
      return interaction.showModal(buildAdminMarkModal());
    }

    // ── admin:edit ─────────────────────────────────────────────────────────────────
    if (customId === 'admin:edit') {
      const { ok } = await requireAdmin(interaction, { context: 'sửa điểm danh' });
      if (!ok) return;
      if (!checkCooldown(interaction.user.id, 'admin_edit', 5000)) {
        return interaction.reply({ content: '⏳ Vui lòng đợi trước khi thực hiện lại thao tác này.', flags: MessageFlags.Ephemeral });
      }
      return interaction.showModal(buildAdminEditModal());
    }

    // ── session:cancel ──────────────────────────────────────────────────────────
    if (customId === 'session:cancel') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (!checkCooldown(interaction.user.id, 'session_cancel', 5000)) return;
      const { ok } = await requireAdmin(interaction, { context: 'hủy phiên', deferred: true });
      if (!ok) return;
      const session = await sessionService.getActiveSession(guild.id);
      if (!session) return interaction.editReply(replyErrEdit('Không có Kỳ nào đang mở.'));
      return interaction.editReply(
        replyConfirm(
          `Bạn có chắc muốn **HỦY** Kỳ **"${session.session_name}"**?\n> Hành động này sẽ hủy Kỳ và giữ nguyên tất cả điểm danh đã ghi.`,
          'session:confirm_cancel',
          'session:cancel_cancel',
        ),
      );
    }

    // ── session:confirm_cancel ───────────────────────────────────────────────────
    if (customId === 'session:confirm_cancel') {
      const { channel } = interaction;
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (!checkCooldown(interaction.user.id, 'session_confirm_cancel', 5000)) return;
      // [SEC-FIX-1] Re-validate admin
      const { ok: okCancel } = await requireAdmin(interaction, { context: 'xác nhận hủy phiên', deferred: true });
      if (!okCancel) return;
      const session = await sessionService.getActiveSession(guild.id);
      if (!session) return interaction.editReply(replyErrEdit('Kỳ đã được đóng hoặc hủy trước đó.'));

      try {
        stopAutoRefresh(session.id);
        await sessionService.cancelSession(session.id, guild.id);
        cancelTimers(guild.id);
        auditLog({ guildId: guild.id, actorId: interaction.user.id, action: 'SESSION_CANCEL', targetId: session.id, metadata: { session_name: session.session_name } }).catch(() => {});
      } catch (e) {
        log.error('CANCEL', guild.id, 'cancelSession thất bại %s: %s', session.id, e.message);
        const stillActive = await sessionService.getActiveSession(guild.id).catch(() => null);
        if (!stillActive) {
          return interaction.editReply(replyOkEdit('✅ Kỳ đã được hủy bởi người khác.'));
        }
        return interaction.editReply(replyErrEdit('Không thể hủy Kỳ do lỗi DB, thử lại sau.'));
      }

      metrics.sessionClosed(guild.id, { cancelled: true });

      const attended = await attendanceService.getAttendances(session.id);
      await Promise.allSettled([
        interaction.editReply(replyOkEdit('✅ Kỳ điểm danh đã được hủy thành công.')),
        disableAttendanceUI(interaction.client, channel, session, attended),
      ]);
    }

    // ── session:cancel_cancel ───────────────────────────────────────────────────
    if (customId === 'session:cancel_cancel') {
      if (!checkCooldown(interaction.user.id, 'session_cancel_cancel', 1000)) return;
      return interaction.reply({ content: '↩️ Đã hủy. Kỳ vẫn đang mở.', flags: MessageFlags.Ephemeral });
    }

    // ── attend_close ─────────────────────────────────────────────────────────────
    if (customId === 'attend_close') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (!checkCooldown(interaction.user.id, 'session_close', 5000)) return;
      const { ok } = await requireAdmin(interaction, { context: 'đóng phiên', deferred: true });
      if (!ok) return;
      const session = await sessionService.getActiveSession(guild.id);
      if (!session) return interaction.editReply(replyErrEdit('Không có Kỳ nào đang mở.'));
      return interaction.editReply(
        replyConfirm(
          `Bạn có chắc muốn đóng Kỳ **"${session.session_name}"**?\n> Hành động này không thể hoàn tác.`,
          'session:confirm_close',
          'session:cancel_close',
        ),
      );
    }

    // ── session:confirm_close ───────────────────────────────────────────────────
    if (customId === 'session:confirm_close') {
      const { channel } = interaction;
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (!checkCooldown(interaction.user.id, 'session_confirm_close', 5000)) return;
      // [SEC-FIX-1] Re-validate admin
      const { ok: okClose } = await requireAdmin(interaction, { context: 'xác nhận đóng phiên', deferred: true });
      if (!okClose) return;
      const session = await sessionService.getActiveSession(guild.id);
      if (!session) return interaction.editReply(replyErrEdit('Kỳ đã được đóng trước đó.'));

      try {
        stopAutoRefresh(session.id);
        await sessionService.closeSession(session.id, guild.id);
        cancelTimers(guild.id);
        auditLog({ guildId: guild.id, actorId: interaction.user.id, action: 'SESSION_CLOSE', targetId: session.id, metadata: { session_name: session.session_name, eligible_count: session.eligible_member_ids?.length } }).catch(() => {});
      } catch (e) {
        log.error('CLOSE', guild.id, 'closeSession thất bại %s: %s', session.id, e.message);
        const stillActive = await sessionService.getActiveSession(guild.id).catch(() => null);
        if (!stillActive) {
          return interaction.editReply(replyOkEdit('✅ Kỳ đã được đóng bởi người khác.'));
        }
        return interaction.editReply(replyErrEdit('Không thể đóng Kỳ do lỗi DB, thử lại sau.'));
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

      const { phaiRoleIds: phaiIds4, emojiMap: emojiMap4 } = await _phaiData(session, guild.id);
      await channel.send({ embeds: [await buildSummaryEmbed(session, attended, guild, phaiIds4, emojiMap4)] }).catch(() => null);
      await announceBadges(guild, channel, guild.id, session.id, attended, statsMap).catch(() => null);
      return interaction.editReply(replyOkEdit('✅ Kỳ điểm danh đã được đóng thành công.'));
    }

    // ── session:cancel_close ────────────────────────────────────────────────────
    if (customId === 'session:cancel_close') {
      if (!checkCooldown(interaction.user.id, 'session_cancel_close', 1000)) return;
      return interaction.reply({ content: '↩️ Đã hủy. Kỳ vẫn đang mở.', flags: MessageFlags.Ephemeral });
    }

    // ── session:confirm_close:all (batch) ───────────────────────────────────────
    if (customId === 'session:confirm_close:all') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (!checkCooldown(interaction.user.id, 'session_confirm_close_all', 5000)) return;
      const { ok: okBatch } = await requireAdmin(interaction, { context: 'đóng tất cả phiên', deferred: true });
      if (!okBatch) return;

      const sessions = await sessionService.getActiveSessions(guild.id);
      if (!sessions.length) return interaction.editReply(replyErrEdit('Không có Kỳ nào để đóng.'));

      for (const s of sessions) stopAutoRefresh(s.id);
      cancelTimers(guild.id);

      let closed = 0;
      let failed = 0;
      for (const s of sessions) {
        try {
          await sessionService.closeSession(s.id, guild.id);
          auditLog({ guildId: guild.id, actorId: interaction.user.id, action: 'SESSION_CLOSE', targetId: s.id, metadata: { session_name: s.session_name, batch: true } }).catch(() => {});
          closed++;
          if (s.channel_id && s.message_id) {
            const ch = await guild.channels.fetch(s.channel_id).catch(() => null);
            if (ch) {
              const attended = await attendanceService.getAttendances(s.id);
              await disableAttendanceUI(interaction.client, ch, s, attended).catch(() => null);
            }
          }
        } catch (e) {
          log.warn('CLOSE_ALL', guild.id, 'Đóng phiên %s thất bại: %s', s.id, e.message);
          failed++;
        }
      }

      log.info('CLOSE_ALL', guild.id, 'Đã đóng %d/%d phiên (%d lỗi)', closed, sessions.length, failed);
      let reply = `Đã đóng **${closed}/${sessions.length}** Kỳ đang mở.`;
      if (failed > 0) reply += `\n⚠️ ${failed} Kỳ gặp lỗi (xem log).`;
      return interaction.editReply(replyOkEdit(reply));
    }

    // ── session:cancel_close:all (batch) ─────────────────────────────────────────
    if (customId === 'session:cancel_close:all') {
      if (!checkCooldown(interaction.user.id, 'session_cancel_close_all', 1000)) return;
      return interaction.reply({ content: '↩️ Đã hủy. Các Kỳ vẫn đang mở.', flags: MessageFlags.Ephemeral });
    }
  }, 'SessionButtonHandler')(interaction); }
}

module.exports = { SessionButtonHandler };
