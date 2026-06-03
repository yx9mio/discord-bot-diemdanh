// interaction-handlers/sessionButton.js
// Handles: nút trên embed phiên (xem/làm mới/đóng/confirm/cancel)
// Refactored ở Commit 6: đã bỏ các branch liên quan tới handlers/ cũ
// (admin:override, upgrade:confirm, setup:dashboard, lichsu:*, setup_help, setup_config).
'use strict';
const { InteractionHandler, InteractionHandlerTypes, AttachmentBuilder } = require('@sapphire/framework');
const db  = require('../db.js');
const log = require('../utils/logger.js');
const { buildCsvBuffer, buildCsvFilename } = require('../utils/csvHelper.js');
const { requireAdmin } = require('../utils/permissions.js');
const {
  buildSessionEmbed, buildSummaryEmbed, buildAttendanceButtons,
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
      const session = await db.getActiveSession(guild.id);
      if (!session) return interaction.reply({ content: '🚫 Không có phiên điểm danh nào đang mở.', ephemeral: true });
      const attended = await db.getAttendances(session.id);

      // [B2] Parse page từ customId (attend_view:prev:N hoặc attend_view:next:N)
      let page = 1;
      if (customId.startsWith('attend_view:')) {
        const parts = customId.split(':');
        const action = parts[1];
        const currentPage = parseInt(parts[2], 10) || 1;
        page = action === 'prev' ? Math.max(1, currentPage - 1) : currentPage + 1;
      }

      const { embed, components } = await buildSessionEmbed(guild, session, attended, session.phai_role_ids ?? [], false, page);
      const method = customId.startsWith('attend_view:') ? 'editReply' : 'reply';
      return interaction[method]({ embeds: [embed], components, ephemeral: true });
    }

    if (customId === 'attend_refresh') {
      await interaction.deferUpdate();
      try {
        const session = await db.getActiveSession(interaction.guildId);
        if (!session) return interaction.followUp({ ...replyErr('Không có phiên điểm danh đang mở.'), ephemeral: true });
        const attended = await db.getAttendances(session.id);
        await interaction.guild.members.fetch().catch(() => {});
        const { embed, components: paginationComponents } = await buildSessionEmbed(interaction.guild, session, attended, session.phai_role_ids ?? [], false);
        await interaction.editReply({ embeds: [embed], components: [buildAttendanceButtons(false), ...paginationComponents] });
        log.info('REFRESH', interaction.guildId, '%s làm mới embed điểm danh', interaction.user.tag);
      } catch (e) {
        log.error('REFRESH', interaction.guildId, 'Lỗi handleRefresh: %s', e.message);
        await interaction.followUp({ ...replyErr('Không thể làm mới, thử lại sau.'), ephemeral: true });
      }
      return;
    }

    if (customId === 'admin:mark') {
      const { ok } = await requireAdmin(interaction, { context: 'điểm danh thay' });
      if (!ok) return;
      const session = await db.getActiveSession(guild.id);
      if (!session) return interaction.reply({ content: '🚫 Không có phiên điểm danh nào đang mở.', ephemeral: true });

      return interaction.showModal(buildAdminMarkModal()); // [C1]
    }

    if (customId === 'session:cancel') {
      await interaction.deferReply({ ephemeral: true });
      const { ok } = await requireAdmin(interaction, { context: 'hủy phiên' });
      if (!ok) return;
      const session = await db.getActiveSession(guild.id);
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
      const session = await db.getActiveSession(guild.id);
      if (!session) return interaction.editReply(replyErrEdit('🚫 Phiên đã được đóng hoặc hủy trước đó.'));

      try {
        stopAutoRefresh(session.id); // [C3]
        await db.cancelSession(session.id);
      } catch (e) {
        log.error('CANCEL', guild.id, 'cancelSession thất bại %s: %s', session.id, e.message);
        return interaction.editReply(replyErrEdit('❌ Không thể hủy phiên do lỗi DB, thử lại sau.'));
      }

      xoaHenGio(guild.id);
      const attended = await db.getAttendances(session.id);
      // Parallel execution: voHieuHoaNutDiemDanh và editReply có thể chạy song song
      const [editResult] = await Promise.all([
        interaction.editReply(replyOkEdit('✅ Phiên điểm danh đã được hủy thành công.')),
        voHieuHoaNutDiemDanh(interaction.client, channel, session, attended),
      ]);
      return editResult;
    }

    if (customId === 'session:cancel_cancel') {
      return interaction.update({ content: '↩️ Đã hủy. Phiên vẫn đang mở.', embeds: [], components: [] });
    }

    if (customId === 'session:export_csv') {
      await interaction.deferReply({ ephemeral: true });
      const { ok } = await requireAdmin(interaction, { context: 'xuất CSV' });
      if (!ok) return;
      const session = await db.getActiveSession(guild.id);
      if (!session) return interaction.editReply(replyErrEdit('🚫 Không có phiên nào đang mở.'));

      const attended = await db.getAttendances(session.id);
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
      await interaction.deferReply({ ephemeral: true });
      const { ok } = await requireAdmin(interaction, { context: 'đóng phiên' });
      if (!ok) return;
      const session = await db.getActiveSession(guild.id);
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
      const session = await db.getActiveSession(guild.id);
      if (!session) return interaction.editReply(replyErrEdit('🚫 Phiên đã được đóng trước đó.'));

      try {
        stopAutoRefresh(session.id); // [C3]
        await db.closeSession(session.id);
      } catch (e) {
        log.error('CLOSE', guild.id, 'closeSession thất bại %s: %s', session.id, e.message);
        return interaction.editReply(replyErrEdit('❌ Không thể đóng phiên do lỗi DB, thử lại sau.'));
      }

      xoaHenGio(guild.id);
      const attended = await db.getAttendances(session.id);
      // Parallel execution: ketThucPhien và voHieuHoaNutDiemDanh độc lập với nhau
      const [statsMap] = await Promise.all([
        ketThucPhien(guild, session, attended),
        voHieuHoaNutDiemDanh(interaction.client, channel, session, attended),
      ]);
      await channel.send({ embeds: [buildSummaryEmbed(session, attended, guild)] });
      await thongBaoHuyHieu(guild, channel, guild.id, session.id, attended, statsMap);
      return interaction.editReply(replyOkEdit('✅ Phiên điểm danh đã được đóng thành công.'));
    }

    if (customId === 'session:cancel_close') {
      return interaction.update({ content: '↩️ Đã hủy. Phiên vẫn đang mở.', embeds: [], components: [] });
    }
  }
}

module.exports = { SessionButtonHandler };
