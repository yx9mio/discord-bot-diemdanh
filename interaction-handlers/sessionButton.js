// interaction-handlers/sessionButton.js
// Handles: nút trên embed phiên (xem/làm mới/đóng/confirm/cancel)
// Refactored ở Commit 6: đã bỏ các branch liên quan tới handlers/ cũ
// (admin:override, upgrade:confirm, setup:dashboard, lichsu:*, setup_help, setup_config).
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const db  = require('../db.js');
const log = require('../utils/logger.js');
const { requireAdmin } = require('../utils/permissions.js');
const {
  buildSessionEmbed, buildSummaryEmbed, buildAttendanceButtons,
  replyErr, replyErrEdit, replyOkEdit, replyConfirm,
} = require('../utils/embeds.js');
const { ketThucPhien, thongBaoHuyHieu, voHieuHoaNutDiemDanh } = require('../utils/session.js');
const { xoaHenGio } = require('../utils/timers.js');

const SESSION_BUTTON_IDS = new Set([
  'attend_view', 'attend_close', 'attend_refresh',
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

    if (customId === 'attend_view') {
      const session = await db.getActiveSession(guild.id);
      if (!session) return interaction.reply({ content: '🚫 Không có phiên điểm danh nào đang mở.', ephemeral: true });
      const attended = await db.getAttendances(session.id);
      return interaction.reply({ embeds: [await buildSessionEmbed(guild, session, attended)], ephemeral: true });
    }

    if (customId === 'attend_refresh') {
      await interaction.deferUpdate();
      try {
        const session = await db.getActiveSession(interaction.guildId);
        if (!session) return interaction.followUp({ ...replyErr('Không có phiên điểm danh đang mở.'), ephemeral: true });
        const attended = await db.getAttendances(session.id);
        await interaction.guild.members.fetch().catch(() => {});
        const embed = await buildSessionEmbed(interaction.guild, session, attended, session.phai_role_ids ?? []);
        await interaction.editReply({ embeds: [embed], components: [buildAttendanceButtons(false)] });
        log.info('REFRESH', interaction.guildId, '%s làm mới embed điểm danh', interaction.user.tag);
      } catch (e) {
        log.error('REFRESH', interaction.guildId, 'Lỗi handleRefresh: %s', e.message);
        await interaction.followUp({ ...replyErr('Không thể làm mới, thử lại sau.'), ephemeral: true });
      }
      return;
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
        await db.closeSession(session.id);
      } catch (e) {
        log.error('CLOSE', guild.id, 'closeSession thất bại %s: %s', session.id, e.message);
        return interaction.editReply(replyErrEdit('❌ Không thể đóng phiên do lỗi DB, thử lại sau.'));
      }

      const attended = await db.getAttendances(session.id);
      xoaHenGio(guild.id);
      const statsMap = await ketThucPhien(guild, session, attended);
      await voHieuHoaNutDiemDanh(interaction.client, channel, session, attended);
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
