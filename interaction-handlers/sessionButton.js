// interaction-handlers/sessionButton.js
// Handles: nút trên embed phiên (xem/làm mới/đóng/confirm/cancel)
// Refactored ở Commit 6: đã bỏ các branch liên quan tới handlers/ cũ
// (admin:override, upgrade:confirm, setup:dashboard, lichsu:*, setup_help, setup_config).
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { MessageFlags, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const sessionService = require('../services/sessionService.js');
const attendanceService = require('../services/attendanceService.js');
const memberService   = require('../services/memberService.js');
const { markAttendance } = require('../utils/attendanceHandler.js');
const { requireAdmin } = require('../utils/permissions.js');
const { buildSessionEmbed, buildSessionButtons } = require('../utils/sessionEmbed.js');
const { replyOk, replyErr, replyOkEdit, replyErrEdit, replyOkPrivate } = require('../utils/replies.js');
const { buildCSV, buildCSVBuffer } = require('../utils/csvExport.js');
const { stopAutoRefresh, xoaHenGio } = require('../utils/sessionScheduler.js');
const { metrics } = require('../utils/metrics.js');
const log = require('../utils/logger.js');

const HANDLED_IDS = new Set([
  'session:view', 'session:refresh',
  'session:cancel', 'session:confirm_cancel', 'session:cancel_cancel',
  'session:confirm_close', 'session:cancel_close',
  'session:attend', 'session:admin_attend',
  'session:export_csv',
]);

class SessionButtonHandler extends InteractionHandler {
  constructor(ctx, opts) {
    super(ctx, { ...opts, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    return HANDLED_IDS.has(interaction.customId) ? this.some() : this.none();
  }

  async run(interaction) {
    const { guild, user, customId } = interaction;
    if (!guild) return interaction.reply(replyErr('❌ Lệnh chỉ dùng trong server.'));

    // ── session:attend ──────────────────────────────────────────────────────────
    if (customId === 'session:attend') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const session = await sessionService.getActiveSession(guild.id);
      if (!session) return interaction.editReply(replyErrEdit('🚫 Không có phiên nào đang mở.'));
      return markAttendance({ guild, member: interaction.member, user, status: 'present', interaction, session, deferred: true });
    }

    // ── session:view ─────────────────────────────────────────────────────────────
    if (customId === 'session:view') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const session = await sessionService.getActiveSession(guild.id);
      if (!session) return interaction.editReply(replyErrEdit('🚫 Không có phiên nào đang mở.'));
      const attendances = await attendanceService.getAttendances(session.id);
      const embed = await buildSessionEmbed(session, attendances, guild);
      return interaction.editReply({ embeds: [embed] });
    }

    // ── session:refresh ───────────────────────────────────────────────────────────
    if (customId === 'session:refresh') {
      await interaction.deferUpdate();
      const session = await sessionService.getActiveSession(guild.id);
      if (!session) return interaction.editReply(replyErrEdit('🚫 Không có phiên nào đang mở.'));
      const attendances = await attendanceService.getAttendances(session.id);
      const embed = await buildSessionEmbed(session, attendances, guild);
      const buttons = buildSessionButtons();
      return interaction.editReply({ embeds: [embed], components: [buttons] });
    }

    // ── session:admin_attend ──────────────────────────────────────────────────────
    if (customId === 'session:admin_attend') {
      const { ok } = await requireAdmin(interaction, { context: 'điểm danh thay' });
      if (!ok) return;
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const session = await sessionService.getActiveSession(guild.id);
      if (!session) return interaction.editReply(replyErrEdit('🚫 Không có phiên nào đang mở.'));
      return markAttendance({ guild, member: interaction.member, user, status: 'present', interaction, session, deferred: true });
    }

    // ── session:cancel ────────────────────────────────────────────────────────────
    if (customId === 'session:cancel') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { ok } = await requireAdmin(interaction, { context: 'hủy phiên', deferred: true });
      if (!ok) return;
      const session = await sessionService.getActiveSession(guild.id);
      if (!session) return interaction.editReply(replyErrEdit('🚫 Không có phiên nào đang mở.'));

      const confirmBtn = new ButtonBuilder()
        .setCustomId('session:confirm_cancel')
        .setLabel('Xác nhận hủy')
        .setStyle(ButtonStyle.Danger);
      const abortBtn = new ButtonBuilder()
        .setCustomId('session:cancel_cancel')
        .setLabel('Thôi, giữ lại')
        .setStyle(ButtonStyle.Secondary);
      const row = new ActionRowBuilder().addComponents(confirmBtn, abortBtn);

      return interaction.editReply({
        content: `⚠️ Bạn có chắc muốn **hủy** phiên **${session.session_name}**? Dữ liệu điểm danh sẽ bị xóa.`,
        components: [row],
      });
    }

    if (customId === 'session:confirm_cancel') {
      const { channel } = interaction;
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      // [SEC-FIX-1] Re-validate admin — ngăn user thường gửi thẳng customId này
      const { ok: okConfirmCancel } = await requireAdmin(interaction, { context: 'xác nhận hủy phiên', deferred: true });
      if (!okConfirmCancel) return;
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
        return interaction.editReply(replyErrEdit('⚠️ Không thể hủy phiên do lỗi DB, thử lại sau.'));
      }

      // [Phase C] Metric: session bị hủy (cancelled)
      metrics.sessionClosed(guild.id, { cancelled: true });

      const attended = await attendanceService.getAttendances(session.id);
      await Promise.allSettled([
        interaction.editReply(replyOkEdit(`✅ Đã hủy phiên **${session.session_name}**.`)),
        channel?.send({ content: `🗑️ Phiên **${session.session_name}** đã bị **hủy** bởi <@${user.id}>. (${attended.length} người đã điểm danh)` }),
      ]);
      return;
    }

    if (customId === 'session:cancel_cancel') {
      return interaction.reply(replyOkPrivate('↩️ Đã hủy hành động. Phiên vẫn đang mở.'));
    }

    // ── session:export_csv ──────────────────────────────────────────────────────
    if (customId === 'session:export_csv') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { ok } = await requireAdmin(interaction, { context: 'xuất CSV', deferred: true });
      if (!ok) return;
      const session = await sessionService.getActiveSession(guild.id);
      if (!session) return interaction.editReply(replyErrEdit('🚫 Không có phiên nào đang mở.'));
      const attendances = await attendanceService.getAttendances(session.id);
      if (!attendances.length) return interaction.editReply(replyErrEdit('📭 Chưa có ai điểm danh.'));
      const buffer = buildCSVBuffer(attendances);
      return interaction.editReply({
        content: `📎 Xuất CSV phiên **${session.session_name}**:`,
        files: [{ attachment: buffer, name: `diemdanh_${session.id}.csv` }],
      });
    }

    // ── session:close (confirm flow) ──────────────────────────────────────────────
    if (customId === 'session:cancel_close') {
      return interaction.reply(replyOkPrivate('↩️ Đã hủy hành động. Phiên vẫn đang mở.'));
    }

    if (customId === 'session:confirm_close') {
      const { channel } = interaction;
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      // [SEC-FIX-1] Re-validate admin — ngăn user thường gửi thẳng customId này
      const { ok: okConfirmClose } = await requireAdmin(interaction, { context: 'xác nhận đóng phiên', deferred: true });
      if (!okConfirmClose) return;
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
        return interaction.editReply(replyErrEdit('⚠️ Không thể đóng phiên do lỗi DB, thử lại sau.'));
      }

      // [Phase C] Metric: session đóng bình thường
      metrics.sessionClosed(guild.id, { cancelled: false });

      const attended = await attendanceService.getAttendances(session.id);
      const cfg = await require('../services/configService.js').getGuildConfig(guild.id);

      // Tổng kết phiên
      const summaryLines = await Promise.all(
        attended.map(async (a) => {
          const stats = await memberService.getMemberStats(guild.id, a.user_id).catch(() => null);
          const streak = stats?.current_streak ?? 0;
          return `• <@${a.user_id}> — ${a.status === 'present' ? '✅' : '❌'} (streak: ${streak})`;
        })
      );

      const summaryEmbed = new EmbedBuilder()
        .setTitle(`📋 Tổng kết phiên: ${session.session_name}`)
        .setDescription(summaryLines.length ? summaryLines.join('\n') : '_Không có ai điểm danh._')
        .setColor(0x57f287)
        .setTimestamp();

      await Promise.allSettled([
        interaction.editReply(replyOkEdit(`✅ Đã đóng phiên **${session.session_name}**.`)),
        channel?.send({ embeds: [summaryEmbed] }),
      ]);
      return;
    }
  }
}

module.exports = { SessionButtonHandler };
