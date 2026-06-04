'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { MessageFlags } = require('discord.js');
const db = require('../db.js');
const log = require('../utils/logger.js');
const metrics = require('../utils/metrics.js'); // [Phase C]
const { buildCsvBuffer, buildCsvFilename } = require('../utils/csvHelper.js');
const { requireAdmin } = require('../utils/permissions.js');
const {
  buildSessionEmbed, buildSummaryEmbed,
  buildSessionActionRow,
  replyErr, replyErrEdit, replyOkEdit, replyConfirm,
  buildClosedSessionEmbed,
} = require('../utils/embeds.js');
const { ketThucPhien, thongBaoHuyHieu, voHieuHoaNutDiemDanh } = require('../utils/session.js');
const { xoaHenGio, stopAutoRefresh } = require('../utils/timers.js');
const { buildAdminMarkModal } = require('../utils/adminMarkModal.js');
const { markAttendance } = require('../utils/attendanceService.js');

const CUSTOM_IDS = new Set([
  'attend_view', 'attend_close', 'attend_refresh', 'admin:mark',
  'attend_view:prev', 'attend_view:next',
  'session:export_csv',
  'session:cancel', 'session:confirm_cancel', 'session:cancel_cancel',
  'session:confirm_close', 'session:cancel_close',
]);

class SessionButtonHandler extends InteractionHandler {
  constructor(ctx, opts) {
    super(ctx, { ...opts, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    return CUSTOM_IDS.has(interaction.customId) ? this.some() : this.none();
  }

  async run(interaction) {
    const { customId, guild, member, user } = interaction;
    if (!guild) return interaction.reply({ ...replyErr('Lệnh này chỉ dùng được trong server.'), flags: MessageFlags.Ephemeral });

    // ── attend_view (xem danh sách) ────────────────────────────────────────
    if (customId === 'attend_view' || customId.startsWith('attend_view:')) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const session = await db.getActiveSession(guild.id);
      if (!session) return interaction.editReply(replyErr('Không có phiên điểm danh đang mở.'));
      const attended = await db.getAttendances(session.id);
      await guild.members.fetch().catch(() => {});

      if (customId.startsWith('attend_view:')) {
        const dir = customId.split(':')[1]; // 'prev' | 'next'
        const curPage = interaction.message?.embeds?.[0]?.footer?.text?.match(/Trang (\d+)/)?.[1] ?? 1;
        const page = dir === 'next' ? Number(curPage) + 1 : Math.max(1, Number(curPage) - 1);
        const { embed, components: pagComponents } = await buildSessionEmbed(guild, session, attended, session.phai_role_ids ?? [], false, page);
        return interaction.editReply({ embeds: [embed], components: [...buildSessionActionRow(false), ...pagComponents] });
      }

      // [#17] Fix: merge buildSessionActionRow + pagComponents (nhất quán với prev/next)
      const { embed, components: pagComponents } = await buildSessionEmbed(guild, session, attended, session.phai_role_ids ?? [], false, 1);
      return interaction.reply({ embeds: [embed], components: [...buildSessionActionRow(false), ...pagComponents], flags: MessageFlags.Ephemeral });
    }

    // ── attend_refresh ──────────────────────────────────────────────────────
    if (customId === 'attend_refresh') {
      await interaction.deferUpdate();
      try {
        const session = await db.getActiveSession(interaction.guildId);
        if (!session) return interaction.followUp({ ...replyErr('Không có phiên điểm danh đang mở.'), flags: MessageFlags.Ephemeral });
        const attended = await db.getAttendances(session.id);
        await interaction.guild.members.fetch().catch(() => {});
        const { embed, components: paginationComponents } = await buildSessionEmbed(interaction.guild, session, attended, session.phai_role_ids ?? [], false);
        await interaction.editReply({ embeds: [embed], components: [...buildSessionActionRow(false), ...paginationComponents] });
      } catch (e) {
        log.error('BUTTON', interaction.guildId, 'attend_refresh lỗi: %s', e.message);
        await interaction.followUp({ ...replyErr('Lỗi khi làm mới danh sách.'), flags: MessageFlags.Ephemeral });
      }
      return;
    }

    // ── attend_close (mở confirm đóng) ─────────────────────────────────────
    if (customId === 'attend_close') {
      if (!requireAdmin(member)) return interaction.reply({ ...replyErr('Bạn không có quyền đóng phiên.'), flags: MessageFlags.Ephemeral });
      const session = await db.getActiveSession(guild.id);
      if (!session) return interaction.reply({ ...replyErr('Không có phiên điểm danh đang mở.'), flags: MessageFlags.Ephemeral });
      return interaction.reply({ ...replyConfirm('Bạn có chắc muốn đóng phiên điểm danh không?', 'session:confirm_close', 'session:cancel_close'), flags: MessageFlags.Ephemeral });
    }

    // ── session:confirm_close ───────────────────────────────────────────────
    if (customId === 'session:confirm_close') {
      if (!requireAdmin(member)) return interaction.reply({ ...replyErr('Bạn không có quyền đóng phiên.'), flags: MessageFlags.Ephemeral });
      await interaction.deferUpdate();
      const session = await db.getActiveSession(guild.id);
      if (!session) return interaction.followUp({ ...replyErr('Không có phiên điểm danh đang mở.'), flags: MessageFlags.Ephemeral });

      await db.closeSession(session.id);
      xoaHenGio(guild.id);
      stopAutoRefresh(session.id);

      const attended = await db.getAttendances(session.id);
      await voHieuHoaNutDiemDanh(interaction.client, guild.channels.cache.get(session.channel_id), session, attended);

      const statsMap = await ketThucPhien(guild, session, attended);
      const ch = guild.channels.cache.get(session.channel_id);
      if (ch) {
        const summaryEmbed = buildSummaryEmbed(session, attended, guild, session.phai_role_ids ?? []);
        await ch.send({ embeds: [summaryEmbed] });
        await thongBaoHuyHieu(guild, ch, guild.id, session.id, attended, statsMap).catch(() => {});
      }

      // [Phase C] Metrics
      metrics.sessionClosed(guild.id, { cancelled: false });
      metrics.sessionMemberCount(guild.id, attended.length);

      return interaction.editReply(replyOkEdit('✅ Phiên điểm danh đã được đóng.'));
    }

    // ── session:cancel_close ────────────────────────────────────────────────
    if (customId === 'session:cancel_close') {
      return interaction.update(replyOkEdit('Đã hủy thao tác đóng phiên.'));
    }

    // ── session:cancel ──────────────────────────────────────────────────────
    if (customId === 'session:cancel') {
      if (!requireAdmin(member)) return interaction.reply({ ...replyErr('Bạn không có quyền hủy phiên.'), flags: MessageFlags.Ephemeral });
      const session = await db.getActiveSession(guild.id);
      if (!session) return interaction.reply({ ...replyErr('Không có phiên điểm danh đang mở.'), flags: MessageFlags.Ephemeral });
      return interaction.reply({ ...replyConfirm('Bạn có chắc muốn HỦY phiên điểm danh không? Dữ liệu sẽ bị xóa.', 'session:confirm_cancel', 'session:cancel_cancel'), flags: MessageFlags.Ephemeral });
    }

    // ── session:confirm_cancel ──────────────────────────────────────────────
    if (customId === 'session:confirm_cancel') {
      if (!requireAdmin(member)) return interaction.reply({ ...replyErr('Bạn không có quyền hủy phiên.'), flags: MessageFlags.Ephemeral });
      await interaction.deferUpdate();
      const session = await db.getActiveSession(guild.id);
      if (!session) return interaction.followUp({ ...replyErr('Không có phiên điểm danh đang mở.'), flags: MessageFlags.Ephemeral });

      await db.cancelSession(session.id);
      xoaHenGio(guild.id);
      stopAutoRefresh(session.id);

      const ch = guild.channels.cache.get(session.channel_id);
      if (ch && session.message_id) {
        const msg = await ch.messages.fetch(session.message_id).catch(() => null);
        if (msg) {
          const closedEmbed = await buildClosedSessionEmbed(session, [], guild);
          await msg.edit({ embeds: [closedEmbed], components: buildSessionActionRow(true) }).catch(() => null);
        }
      }

      // [Phase C] Metrics
      metrics.sessionClosed(guild.id, { cancelled: true });

      return interaction.editReply(replyOkEdit('✅ Phiên điểm danh đã bị hủy.'));
    }

    // ── session:cancel_cancel ───────────────────────────────────────────────
    if (customId === 'session:cancel_cancel') {
      return interaction.update(replyOkEdit('Đã hủy thao tác.'));
    }

    // ── session:export_csv ──────────────────────────────────────────────────
    if (customId === 'session:export_csv') {
      if (!requireAdmin(member)) return interaction.reply({ ...replyErr('Bạn không có quyền xuất CSV.'), flags: MessageFlags.Ephemeral });
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const session = await db.getActiveSession(guild.id);
      if (!session) return interaction.editReply(replyErr('Không có phiên điểm danh đang mở.'));
      const attended = await db.getAttendances(session.id);
      const buffer = buildCsvBuffer(attended);
      const filename = buildCsvFilename(session);
      return interaction.editReply({ files: [{ attachment: buffer, name: filename }] });
    }

    // ── admin:mark ──────────────────────────────────────────────────────────
    if (customId === 'admin:mark') {
      if (!requireAdmin(member)) return interaction.reply({ ...replyErr('Bạn không có quyền điểm danh hộ.'), flags: MessageFlags.Ephemeral });
      const session = await db.getActiveSession(guild.id);
      if (!session) return interaction.reply({ ...replyErr('Không có phiên điểm danh đang mở.'), flags: MessageFlags.Ephemeral });
      const modal = buildAdminMarkModal(session.id);
      return interaction.showModal(modal);
    }
  }
}

module.exports = { SessionButtonHandler };
