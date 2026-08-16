// [FIX-OPTS] Phân trang trang 2+ cho phép phiên đóng / admin edit / xem danh sách
// [FIX-SELECT] attend_view pagination + attend_refresh: thêm buildAttendanceSelectRow(true)
//   để select menu không bị mất sau khi paginate hoặc refresh
'use strict';
const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const sessionService = require('../../services/sessionService.js');
const attendanceService = require('../../services/attendanceService.js');
const log = require('../../utils/logger.js');
const metrics = require('../../utils/metrics.js');
const { requireAdmin } = require('../../utils/permissions.js');
const configService = require('../../services/configService.js');
const { buildAttendanceExcel } = require('../../utils/attendanceExcel.js');
const {
  buildSessionEmbed,
  buildSessionActionRow, buildAttendanceSelectRow, buildAttendanceFilterRow,
  replyErr, replyErrEdit, replyOkEdit, replyConfirm,
} = require('../../utils/embeds.js');
const { endSession, announceBadges, disableAttendanceUI } = require('../../utils/session.js');
const { stopAutoRefresh } = require('../../utils/timers.js');
const { auditLog } = require('../../utils/auditLog.js');
const { wrapHandler } = require('../../utils/error-boundary.js');
const { checkCooldown } = require('../../utils/cooldown.js');

// [BUG-FIX] Đồng bộ với tất cả customId được dùng trong file này
const SESSION_BUTTON_IDS = new Set([
  'attend_view', 'attend_list', 'attend_close', 'attend_refresh', 'admin:mark', 'admin:edit',
  'attend_view:prev', 'attend_view:next',
  'attend_list:prev', 'attend_list:next',
  'session:cancel', 'session:confirm_cancel', 'session:cancel_cancel',
  'session:confirm_close', 'session:cancel_close',
  'session:confirm_close:all', 'session:cancel_close:all',
  'session:confirm_close:single',
]);

async function _phaiData(session, guildId) {
  const cfg = await configService.getGuildConfig(guildId).catch(() => null);
  const phaiRoleIds = session.phai_role_ids?.length
    ? session.phai_role_ids
    : cfg?.phai_role_ids ?? [];
  const emojiMap = cfg?.phai_role_icons ?? null;
  return { phaiRoleIds, emojiMap };
}

class SessionButtonHandler extends InteractionHandler {
  constructor(context, options) {
    super(context, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.Button,
    });
  }

  parse(interaction) {
    // Prefix match cho attend_view:prev / attend_view:next
    if (SESSION_BUTTON_IDS.has(interaction.customId)) return this.some();
    if (interaction.customId.startsWith('attend_view:')) return this.some();
    if (interaction.customId.startsWith('attend_list:')) return this.some();
    return this.none();
  }

  async run(interaction) {
    return wrapHandler(this._handle.bind(this), 'SessionButton')(interaction);
  }

  async _handle(interaction) {
    const { customId, guild } = interaction;
    if (!guild) return;

    // ── attend_view (Mở phiếu điểm danh cá nhân — ephemeral per-user) ────────
    if (customId === 'attend_view' || customId.startsWith('attend_view:')) {
      if (!checkCooldown(interaction.user.id, 'session_view', 1000)) {
        return interaction.reply({ content: '⏳ Vui lòng đợi một chút...', flags: MessageFlags.Ephemeral });
      }

      const session = await sessionService.getActiveSession(guild.id);
      if (!session) {
        if (customId.startsWith('attend_view:')) {
          await interaction.deferUpdate();
          return interaction.editReply({ content: '🚫 Kỳ đã kết thúc.', embeds: [], components: [] });
        }
        return interaction.reply({ content: '🚫 Không có Kỳ điểm danh nào đang mở.', flags: MessageFlags.Ephemeral });
      }

      const attended = await attendanceService.getAttendances(session.id);
      const { phaiRoleIds: phaiIdsV, emojiMap: emojiMapV } = await _phaiData(session, guild.id);

      // Phân trang trong phiếu điểm danh cá nhân
      if (customId.startsWith('attend_view:')) {
        await interaction.deferUpdate();
        const parts = customId.split(':');
        const action = parts[1];
        const currentPage = parseInt(parts[2], 10) || 1;
        const totalPages = Math.max(1, Math.ceil(attended.length / 15));
        const page = action === 'prev'
          ? Math.max(1, currentPage - 1)
          : Math.min(totalPages, currentPage + 1);

        await guild.members.fetch().catch(() => {});
        await guild.roles.fetch().catch(() => {});
        const { embed, components: pagComponents } =
          buildSessionEmbed(guild, session, attended, phaiIdsV, false, page, emojiMapV, true, { showList: false });
        return interaction.editReply({
          embeds: [embed],
          components: [buildAttendanceSelectRow(true), ...pagComponents],
        });
      }

      // Mở mới phiếu điểm danh cá nhân
      await guild.members.fetch().catch(() => {});
      await guild.roles.fetch().catch(() => {});
      const { embed, components: pagComponents } =
        buildSessionEmbed(guild, session, attended, phaiIdsV, false, 1, emojiMapV, true, { showList: false });
      return interaction.reply({
        embeds: [embed],
        components: [buildAttendanceSelectRow(true), ...pagComponents],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── attend_list / attend_list:prev / attend_list:next / attend_list:filter / attend_list:excel ──
    if (customId === 'attend_list' || customId.startsWith('attend_list:')) {
      if (!checkCooldown(interaction.user.id, 'session_view', 1000)) {
        return interaction.reply({ content: '⏳ Vui lòng đợi một chút...', flags: MessageFlags.Ephemeral });
      }

      const parts = customId.split(':');
      const action = parts[1];

      // Tìm target sessionId từ customId (nếu có nhúng ở cuối)
      let targetSessionId = null;
      if (action === 'excel' && parts[2]) {
        targetSessionId = parts[2];
      } else if (action === 'filter' && parts[3]) {
        targetSessionId = parts[3];
      } else if ((action === 'prev' || action === 'next') && parts[4]) {
        targetSessionId = parts[4];
      }

      // Resolve session: thử theo targetSessionId -> phiên active -> session theo message_id
      let session = null;
      if (targetSessionId) {
        session = await sessionService.getSessionById(targetSessionId).catch(() => null);
      }
      if (!session) {
        session = await sessionService.getActiveSession(guild.id);
      }
      if (!session) {
        const msgId = interaction.message?.id;
        if (msgId) session = await sessionService.getSessionByMessageId(msgId).catch(() => null);
      }

      // ── attend_list:excel — xuất file Excel (admin only) ────────────────────
      if (action === 'excel') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const { ok } = await requireAdmin(interaction, { context: 'xuất file Excel', deferred: true });
        if (!ok) return;

        if (!session) return interaction.editReply(replyErrEdit('Không tìm thấy Kỳ điểm danh.'));
        try {
          // Nạp cache thành viên & role trước khi xuất Excel
          await Promise.all([
            guild.members.fetch().catch(() => {}),
            guild.roles.fetch().catch(() => {}),
          ]);
          const attended = await attendanceService.getAttendances(session.id);
          const buffer = await buildAttendanceExcel(session, attended, guild);
          const fileName = `diem-danh_${(session.session_name ?? 'ky').replace(/[^\w\d\-_.]+/g, '_')}.xlsx`;
          return interaction.editReply({
            content: `📥 File Excel Kỳ **"${session.session_name}"** — ${attended.length} người.`,
            files: [{ attachment: buffer, name: fileName }],
          });
        } catch (e) {
          log.error('EXCEL', guild.id, 'Xuất Excel thất bại: %s', e.message);
          return interaction.editReply(replyErrEdit('Không thể xuất file Excel, thử lại sau.'));
        }
      }

      if (!session) {
        if (customId.startsWith('attend_list:')) {
          await interaction.deferUpdate();
          return interaction.editReply({ content: '🚫 Kỳ đã kết thúc hoặc không tìm thấy dữ liệu.', embeds: [], components: [] });
        }
        return interaction.reply({ content: '🚫 Không có Kỳ điểm danh nào đang mở.', flags: MessageFlags.Ephemeral });
      }

      const attended = await attendanceService.getAttendances(session.id);

      const VALID_FILTERS = ['all', 'tham_gia', 'tre', 'khong_tham_gia', 'co_phep'];
      const filter = VALID_FILTERS.includes(parts[3]) ? parts[3] : 'all';

      const { phaiRoleIds: phaiIdsL, emojiMap: emojiMapL } = await _phaiData(session, guild.id);
      await Promise.all([
        guild.members.fetch().catch(() => {}),
        guild.roles.fetch().catch(() => {}),
      ]);

      const buildList = (page, f) => buildSessionEmbed(
        guild, session, attended, phaiIdsL, false, page, emojiMapL, true,
        { paginationPrefix: 'attend_list', filter: f, allowClosed: true, sessionId: session.id },
      );
      const excelRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`attend_list:excel:${session.id}`)
          .setLabel('📥 Xuất Excel')
          .setStyle(ButtonStyle.Success),
      );

      if (customId.startsWith('attend_list:')) {
        await interaction.deferUpdate();

        // ── Filter button → chuyển filter, về trang 1 ──
        if (action === 'filter') {
          const newFilter = VALID_FILTERS.includes(parts[2]) ? parts[2] : 'all';
          const { embed, components } = buildList(1, newFilter);
          return interaction.editReply({
            embeds: [embed],
            components: [buildAttendanceFilterRow(newFilter, session.id), ...components, excelRow],
          });
        }

        // ── prev / next (giữ nguyên filter) ──
        const currentPage = parseInt(parts[2], 10) || 1;
        const activeFilter = VALID_FILTERS.includes(parts[3]) ? parts[3] : 'all';
        const filteredCount = activeFilter === 'all'
          ? attended.length
          : attended.filter(a => a.status === activeFilter).length;
        const totalPages = Math.max(1, Math.ceil(filteredCount / 15));
        const page = action === 'prev'
          ? Math.max(1, currentPage - 1)
          : Math.min(totalPages, currentPage + 1);
        const { embed, components } = buildList(page, activeFilter);
        return interaction.editReply({
          embeds: [embed],
          components: [buildAttendanceFilterRow(activeFilter, session.id), ...components, excelRow],
        });
      }

      // Mở view danh sách đầy đủ (ephemeral per-user) — mặc định filter 'all'
      const { embed, components } = buildList(1, 'all');
      return interaction.reply({
        embeds: [embed],
        components: [buildAttendanceFilterRow('all', session.id), ...components, excelRow],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── attend_refresh ────────────────────────────────────────────────────────────
    if (customId === 'attend_refresh') {
      if (!checkCooldown(interaction.user.id, 'session_refresh', 1000)) {
        return interaction.reply({ content: '⏳ Vui lòng đợi một chút...', flags: MessageFlags.Ephemeral });
      }
      await interaction.deferUpdate();
      const session = await sessionService.getActiveSession(guild.id);
      if (!session) {
        return interaction.editReply({ content: '🚫 Kỳ đã kết thúc.', embeds: [], components: [] });
      }
      const attended = await attendanceService.getAttendances(session.id);
      const { phaiRoleIds: phaiIdsR, emojiMap: emojiMapR } = await _phaiData(session, guild.id);
      await Promise.all([
        guild.members.fetch().catch(() => {}),
        guild.roles.fetch().catch(() => {}),
      ]);
      const { embed, components: pagComponents } =
        buildSessionEmbed(guild, session, attended, phaiIdsR, false, 1, emojiMapR, true, { showList: false });
      return interaction.editReply({
        embeds: [embed],
        components: [buildAttendanceSelectRow(true), ...pagComponents],
      });
    }

    // ── admin:mark (Điểm danh thay — mở Modal) ────────────────────────────────────
    if (customId === 'admin:mark') {
      const { ok } = await requireAdmin(interaction, { context: 'điểm danh thay' });
      if (!ok) return;
      const { showAdminMarkModal } = require('../../utils/adminMarkModal.js');
      return showAdminMarkModal(interaction);
    }

    // ── admin:edit (Sửa điểm danh — mở Modal) ─────────────────────────────────────
    if (customId === 'admin:edit') {
      const { ok } = await requireAdmin(interaction, { context: 'sửa điểm danh' });
      if (!ok) return;
      const { showAdminEditModal } = require('../../utils/adminEditModal.js');
      return showAdminEditModal(interaction);
    }

    // ── session:cancel (Hủy phiên — xác nhận) ────────────────────────────────────
    if (customId === 'session:cancel') {
      const { ok } = await requireAdmin(interaction, { context: 'hủy phiên điểm danh' });
      if (!ok) return;
      return interaction.reply(
        replyConfirm(
          '🗑️ Bạn có chắc muốn **HỦY** Kỳ điểm danh này không?\n\n' +
          '> ⚠️ Toàn bộ dữ liệu điểm danh của phiên này sẽ bị hủy và **không được tính vào thống kê**.',
          'session:confirm_cancel',
          'session:cancel_cancel',
        )
      );
    }

    // ── session:cancel_cancel ─────────────────────────────────────────────────────
    if (customId === 'session:cancel_cancel') {
      return interaction.update({ content: 'Đã hủy thao tác.', embeds: [], components: [] });
    }

    // ── session:confirm_cancel (Hủy phiên — thực hiện) ───────────────────────────
    if (customId === 'session:confirm_cancel') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { ok } = await requireAdmin(interaction, { context: 'hủy phiên điểm danh', deferred: true });
      if (!ok) return;

      const session = await sessionService.getActiveSession(guild.id);
      if (!session) {
        return interaction.editReply(replyErrEdit('Không có Kỳ điểm danh nào đang mở.'));
      }

      await sessionService.cancelSession(session.id, guild.id);
      auditLog({ guildId: guild.id, actorId: interaction.user.id, action: 'SESSION_CANCEL', metadata: { sessionId: session.id } }).catch(() => {});
      stopAutoRefresh(session.id);

      const channel = interaction.channel;
      await disableAttendanceUI(interaction.client, channel, session, []).catch(() => null);

      log.info('SESSION_CANCEL', guild.id, 'Admin %s đã hủy phiên %s', interaction.user.tag, session.session_name);
      metrics.sessionClosed(guild.id, { cancelled: true });

      return interaction.editReply(replyOkEdit('🗑️ Kỳ điểm danh đã được hủy thành công.'));
    }

    // ── attend_close (Đóng phiên — xác nhận) ─────────────────────────────────────
    if (customId === 'attend_close') {
      const { ok } = await requireAdmin(interaction, { context: 'đóng phiên điểm danh' });
      if (!ok) return;

      const sessions = await sessionService.getActiveSessions(guild.id);
      if (!sessions || sessions.length === 0) {
        return interaction.reply(replyErr('Không có Kỳ điểm danh nào đang mở.'));
      }

      if (sessions.length === 1) {
        const s = sessions[0];
        return interaction.reply(
          replyConfirm(
            `🔒 Bạn có chắc muốn đóng Kỳ **"${s.session_name}"** không?\n\n` +
            '> Sau khi đóng, thành viên không thể điểm danh thêm. Kết quả sẽ được tổng kết và cập nhật vào hệ thống.',
            'session:confirm_close',
            'session:cancel_close',
          )
        );
      }

      const rows = [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('session:confirm_close:single')
            .setLabel(`Đóng phiên này: "${sessions[0].session_name}"`)
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('session:confirm_close:all')
            .setLabel(`Đóng TẤT CẢ (${sessions.length} phiên)`)
            .setStyle(ButtonStyle.Danger),
        ),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('session:cancel_close:all')
            .setLabel('Hủy')
            .setStyle(ButtonStyle.Secondary),
        ),
      ];

      return interaction.reply({
        content: `⚠️ Có **${sessions.length} phiên** đang mở đồng thời. Bạn muốn đóng phiên nào?`,
        components: rows,
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── session:cancel_close / cancel_close:all ───────────────────────────────────
    if (customId === 'session:cancel_close' || customId === 'session:cancel_close:all') {
      return interaction.update({ content: 'Đã hủy thao tác đóng phiên.', embeds: [], components: [] });
    }

    // ── session:confirm_close:all (Đóng tất cả các phiên đang mở) ────────────────
    if (customId === 'session:confirm_close:all') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { ok } = await requireAdmin(interaction, { context: 'đóng tất cả phiên điểm danh', deferred: true });
      if (!ok) return;

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

    // ── session:confirm_close / session:confirm_close:single (Đóng phiên hiện tại) ──
    if (customId === 'session:confirm_close' || customId === 'session:confirm_close:single') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { ok } = await requireAdmin(interaction, { context: 'đóng phiên điểm danh', deferred: true });
      if (!ok) return;

      const session = await sessionService.getActiveSession(guild.id);
      if (!session) {
        return interaction.editReply(replyErrEdit('Không có Kỳ điểm danh nào đang mở.'));
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
      const channel = interaction.channel;
      await disableAttendanceUI(interaction.client, channel, session, attended).catch(() => null);

      log.info('SESSION_CLOSE', guild.id, 'Admin %s đã đóng phiên %s (%d người)', interaction.user.tag, session.session_name, attended.length);
      metrics.sessionClosed(guild.id, { cancelled: false });
      metrics.sessionMemberCount(guild.id, attended.length);

      await announceBadges(guild, channel, guild.id, session.id, attended, statsMap).catch(() => null);
      return interaction.editReply(replyOkEdit('✅ Kỳ điểm danh đã được đóng thành công.'));
    }
  }
}

module.exports = { SessionButtonHandler };
