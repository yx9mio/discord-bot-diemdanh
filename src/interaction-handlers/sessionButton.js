// [UX-W1] Board không còn hàng admin: xóa attend_refresh / attend_close /
// session:cancel / confirm-close, cancel — chuyển toàn bộ sang /setup SessionView
'use strict';
const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const sessionService = require('../../services/sessionService.js');
const attendanceService = require('../../services/attendanceService.js');
const log = require('../../utils/logger.js');
const { requireAdmin, isAdmin } = require('../../utils/permissions.js');
const configService = require('../../services/configService.js');
const { buildAttendanceExcel } = require('../../utils/attendanceExcel.js');
const {
  buildSessionEmbed,
  buildAttendanceFilterRow, renderAttendancePanel,
  replyErrEdit,
} = require('../../utils/embeds.js');
const { wrapHandler } = require('../../utils/error-boundary.js');
const { checkCooldown } = require('../../utils/cooldown.js');

// [BUG-FIX] Đồng bộ với tất cả customId được dùng trong file này
// [FIX] admin:mark / admin:edit nhúng sessionId: admin:mark:<sid> (legacy: 'admin:mark')
const SESSION_BUTTON_IDS = new Set([
  'attend_view', 'attend_list', 'admin:mark', 'admin:edit',
]);

const ADMIN_MARK_PREFIX = 'admin:mark:';
const ADMIN_EDIT_PREFIX = 'admin:edit:';

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
    if (SESSION_BUTTON_IDS.has(interaction.customId)) return this.some();
    if (interaction.customId.startsWith('attend_list:')) return this.some();
    if (interaction.customId.startsWith(ADMIN_MARK_PREFIX)) return this.some();
    if (interaction.customId.startsWith(ADMIN_EDIT_PREFIX)) return this.some();
    return this.none();
  }

  async run(interaction) {
    return wrapHandler(this._handle.bind(this), 'SessionButton')(interaction);
  }

  async _handle(interaction) {
    const { customId, guild } = interaction;
    if (!guild) return;

    // ── attend_view (Mở phiếu điểm danh cá nhân — ephemeral per-user) ────────
    if (customId === 'attend_view') {
      if (!checkCooldown(interaction.user.id, 'session_view', 1000)) {
        return interaction.reply({ content: '⏳ Vui lòng đợi một chút...', flags: MessageFlags.Ephemeral });
      }

      const session = await sessionService.getActiveSession(guild.id);
      if (!session) {
        return interaction.reply({ content: '🚫 Không có Kỳ điểm danh nào đang mở.', flags: MessageFlags.Ephemeral });
      }

      // Mở mới phiếu điểm danh cá nhân
      await guild.members.fetch().catch(() => {});
      await guild.roles.fetch().catch(() => {});
      const { embed, components } = await renderAttendancePanel(guild, session, { userId: interaction.user.id });
      return interaction.reply({
        embeds: [embed],
        components,
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
          const fileName = `diem-danh_${(session.session_name ?? 'ky').replace(/[^\w.-]+/g, '_')}.xlsx`;
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

      const { phaiRoleIds: phaiIdsL, emojiMap: emojiMapL } = await _phaiData(session, guild.id);
      await Promise.all([
        guild.members.fetch().catch(() => {}),
        guild.roles.fetch().catch(() => {}),
      ]);

      const buildList = (page, f) => buildSessionEmbed(
        guild, session, attended, phaiIdsL, false, page, emojiMapL, true,
        { paginationPrefix: 'attend_list', filter: f, allowClosed: true, sessionId: session.id },
      );
      const adminUser = await isAdmin(interaction);
      const excelRow = adminUser ? new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`attend_list:excel:${session.id}`)
          .setLabel('📥 Xuất Excel')
          .setStyle(ButtonStyle.Success),
      ) : null;

      if (customId.startsWith('attend_list:')) {
        await interaction.deferUpdate();

        // ── Filter button → chuyển filter, về trang 1 ──
        if (action === 'filter') {
          const newFilter = VALID_FILTERS.includes(parts[2]) ? parts[2] : 'all';
          const { embed, components } = buildList(1, newFilter);
          return interaction.editReply({
            embeds: [embed],
            components: [buildAttendanceFilterRow(newFilter, session.id), ...components, ...(excelRow ? [excelRow] : [])],
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
          components: [buildAttendanceFilterRow(activeFilter, session.id), ...components, ...(excelRow ? [excelRow] : [])],
        });
      }

      // Mở view danh sách đầy đủ (ephemeral per-user) — mặc định filter 'all'
      const { embed, components } = buildList(1, 'all');
      return interaction.reply({
        embeds: [embed],
        components: [buildAttendanceFilterRow('all', session.id), ...components, ...(excelRow ? [excelRow] : [])],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── admin:mark (Điểm danh thay — mở Modal) ────────────────────────────────────
    // [UX-W1] Giờ chỉ xuất hiện trên /setup SessionView (Admin Control Center)
    // [FIX] Nhúng sessionId để thao tác đúng Kỳ đang xem khi có nhiều Kỳ
    if (customId === 'admin:mark' || customId.startsWith(ADMIN_MARK_PREFIX)) {
      const { ok } = await requireAdmin(interaction, { context: 'điểm danh thay' });
      if (!ok) return;
      const { showAdminMarkModal } = require('../../utils/adminMarkModal.js');
      const sessionId = customId.startsWith(ADMIN_MARK_PREFIX) ? customId.slice(ADMIN_MARK_PREFIX.length) : null;
      return showAdminMarkModal(interaction, sessionId);
    }

    // ── admin:edit (Sửa điểm danh — mở Modal) ─────────────────────────────────────
    if (customId === 'admin:edit' || customId.startsWith(ADMIN_EDIT_PREFIX)) {
      const { ok } = await requireAdmin(interaction, { context: 'sửa điểm danh' });
      if (!ok) return;
      const { showAdminEditModal } = require('../../utils/adminEditModal.js');
      const sessionId = customId.startsWith(ADMIN_EDIT_PREFIX) ? customId.slice(ADMIN_EDIT_PREFIX.length) : null;
      return showAdminEditModal(interaction, sessionId);
    }
  }
}

module.exports = { SessionButtonHandler };
