// interaction-handlers/sessionButton.js
// Handles: nút trên embed phiên (xem/làm mới/đóng/confirm/cancel)
// Refactored ở Commit 6: đã bỏ các branch liên quan tới handlers/ cũ
// (admin:override, upgrade:confirm, setup:dashboard, lichsu:*, setup_help, setup_config).
'use strict';
const { MessageFlags, AttachmentBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { getActiveSession } = require('../services/sessionService.js');         // [FIX] db.js → sessionService
const { getAttendances, cancelSession, closeSession } = require('../services/sessionService.js'); // [FIX]
const sessionService = require('../services/sessionService.js');               // [FIX] full import for all methods
const attendanceService = require('../services/attendanceService.js');         // [FIX] db.getAttendances
const log = require('../utils/logger.js');
const metrics = require('../utils/metrics.js'); // [Phase C]
const { buildCsvBuffer, buildCsvFilename } = require('../utils/csvHelper.js');
const { requireAdmin } = require('../utils/permissions.js');
const {
  buildSessionEmbed, buildSummaryEmbed, // [FIX] buildAttendanceButtons removed (obsolete)
  buildSessionActionRow,
  replyErr, replyErrEdit, replyOkEdit, replyConfirm,
} = require('../utils/embeds.js');
const { ketThucPhien, thongBaoHuyHieu, voHieuHoaNutDiemDanh } = require('../utils/session.js');
const { xoaHenGio, stopAutoRefresh } = require('../utils/timers.js');
const { buildAdminMarkModal } = require('../utils/adminMarkModal.js');

const SESSION_BUTTON_IDS = new Set([
  'attend_view', 'attend_close', 'attend_refresh', 'admin:mark',
  'attend_view:prev', 'attend_view:next',
  'session:export_csv',
  'session:cancel', 'session:confirm_cancel', 'session:cancel_cancel',
  'session:confirm_close', 'session:cancel_close',
]);

class SessionButtonHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (SESSION_BUTTON_IDS.has(interaction.customId)) return this.some();
    return this.none();
  }

  async run(interaction) {
    const { customId, guild } = interaction;

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
        const page = action === 'prev' ? Math.max(1, currentPage - 1) : currentPage + 1;
        const { embed, components: pagComponents } = await buildSessionEmbed(guild, session, attended, session.phai_role_ids ?? [], false, page);
        return interaction.editReply({ embeds: [embed], components: [...buildSessionActionRow(false), ...pagComponents] });
      }

      const { embed, components } = await buildSessionEmbed(guild, session, attended, session.phai_role_ids ?? [], false, 1);
      return interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
    }

    if (customId === 'attend_refresh') {
      await interaction.deferUpdate();
      try {
        const session = await sessionService.getActiveSession(interaction.guildId);
        if (!session) return interaction.followUp({ ...replyErr('Không có phiên điểm danh đang mở.'), flags: MessageFlags.Ephemeral });
        const attended = await attendanceService.getAttendances(session.id);
        await interaction.guild.members.fetch().catch(() => {});
        const { embed, components: paginationComponents } = await buildSessionEmbed(interaction.guild, session, attended, session.phai_role_ids ?? [], false);
        await interaction.editReply({ embeds: [embed], components: [...buildSessionActionRow(false), ...paginationComponents] });
        log.info('REFRESH', interaction.guildId, '%s làm mới embed điểm danh', interaction.user.tag);
      } catch (e) {
        log.error('REFRESH', interaction.guildId, 'Lỗi handleRefresh: %s', e.message);
        await interaction.followUp({ ...replyErr('Không thể làm mới, thử lại sau.'), flags: MessageFlags.Ephemeral });
      }
      return;
    }

    if (customId === 'admin:mark') {
      // [BUG-F] Fix: Bỏ db.getActiveSession trước showModal để tránh timeout.
      // Session check đã có trong adminMarkModal.js:run() sau khi modal submit.
      const { ok } = await requireAdmin(interaction, { context: 'điểm danh thay' });
      if (!ok) return;
      return interaction.showModal(buildAdminMarkModal());
    }

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

    if (customId === 'session:confirm_cancel') {
      const { channel } = interaction;
      await interaction.deferUpdate();
      const session = await sessionService.getActiveSession(guild.id);
      if (!session) return interaction.editReply(replyErrEdit('🚫 Phiên đã được đóng hoặc hủy trước đó.'));

      try {
        stopAutoRefresh(session.id);
        await sessionService.cancelSession(session.id);
        xoaHenGio(guild.id);
      } catch (e) {
        log.error('CANCEL', guild.id, 'cancelSession thất bại %s: %s', session.id, e.message);
        const stillActive = await sessionService.getActiveSession(guild.id).catch(() => null);
        if (!stillActive) {
          return interaction.editReply(replyOkEdit('✅ Phiên đã được hủy bởi người khác.'));
        }
        return interaction.editReply(replyErrEdit('❌ Không thể hủy phiên do lỗi DB, thử lại sau.'));
      }

      // [Phase C] Metric: session bị hủy (cancelled)
      metrics.sessionClosed(guild.id, { cancelled: true });

      const attended = await attendanceService.getAttendances(session.id);
      await Promise.allSettled([
        interaction.editReply(replyOkEdit('✅ Phiên điểm danh đã được hủy thành công.')),
        voHieuHoaNutDiemDanh(interaction.client, channel, session, attended),
      ]);
    }

    if (customId === 'session:cancel_cancel') {
      return interaction.update({ content: '↩️ Đã hủy. Phiên vẫn đang mở.', embeds: [], components: [] });
    }

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

    if (customId === 'session:confirm_close') {
      const { channel } = interaction;
      await interaction.deferUpdate();
      const session = await sessionService.getActiveSession(guild.id);
      if (!session) return interaction.editReply(replyErrEdit('🚫 Phiên đã được đóng trước đó.'));

      try {
        stopAutoRefresh(session.id);
        await sessionService.closeSession(session.id);
        xoaHenGio(guild.id);
      } catch (e) {
        log.error('CLOSE', guild.id, 'closeSession thất bại %s: %s', session.id, e.message);
        const stillActive = await sessionService.getActiveSession(guild.id).catch(() => null);
        if (!stillActive) {
          return interaction.editReply(replyOkEdit('✅ Phiên đã được đóng bởi người khác.'));
        }
        return interaction.editReply(replyErrEdit('❌ Không thể đóng phiên do lỗi DB, thử lại sau.'));
      }

      const attended = await attendanceService.getAttendances(session.id);
      const [settledKetThuc] = await Promise.allSettled([
        ketThucPhien(guild, session, attended),
        voHieuHoaNutDiemDanh(interaction.client, channel, session, attended),
      ]);
      const statsMap = settledKetThuc.status === 'fulfilled' ? settledKetThuc.value : null;

      // [Phase C] Metrics: session đóng thủ công (normal) + member count
      metrics.sessionClosed(guild.id, { cancelled: false });
      metrics.sessionMemberCount(guild.id, attended.length);

      // [#5-D1] await buildSummaryEmbed vì đã thành async (resolveDisplayNameAsync)
      await channel.send({ embeds: [await buildSummaryEmbed(session, attended, guild, session.phai_role_ids ?? [])] }).catch(() => null);
      await thongBaoHuyHieu(guild, channel, guild.id, session.id, attended, statsMap).catch(() => null);
      return interaction.editReply(replyOkEdit('✅ Phiên điểm danh đã được đóng thành công.'));
    }

    if (customId === 'session:cancel_close') {
      return interaction.update({ content: '↩️ Đã hủy. Phiên vẫn đang mở.', embeds: [], components: [] });
    }
  }
}

module.exports = { SessionButtonHandler };
