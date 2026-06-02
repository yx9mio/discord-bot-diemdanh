// interaction-handlers/sessionButton.js
// BUG-5 fix: dùng db.getConfig (alias)
// BUG-8 fix: return sớm khi closeSession throw
// BUG-10 fix: loại bỏ duplicate modal handler
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const db  = require('../db.js');
const log = require('../utils/logger.js');
const { requireAdmin } = require('../utils/permissions.js');
const {
  buildSessionEmbed, buildSummaryEmbed, buildAttendanceButtons, buildConfigEmbed,
  replyErrEdit, replyOkEdit, replyConfirm, replyErr,
} = require('../utils/embeds.js');
const { ketThucPhien, thongBaoHuyHieu, voHieuHoaNutDiemDanh } = require('../utils/session.js');
const { xoaHenGio } = require('../utils/timers.js');
const { handleSetupUi } = require('../handlers/setup/index.js');

const SESSION_BUTTON_IDS = new Set([
  'attend_view', 'attend_close', 'attend_refresh',
  'session:confirm_close', 'session:cancel_close',
  'admin:override', 'upgrade:confirm',
  'setup_help', 'setup_config',
]);

class SessionButtonHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (
      SESSION_BUTTON_IDS.has(id) ||
      id?.startsWith('lichsu:') ||
      id?.startsWith('setup:')
    ) return this.some();
    return this.none();
  }

  async run(interaction) {
    const { customId, guild } = interaction;

    // Setup wizard
    if (customId?.startsWith('setup:')) return handleSetupUi(interaction);

    // Shortcuts setup panel
    if (customId === 'setup_help') {
      const { execute } = require('../src/commands/help.js');
      return execute(interaction);
    }
    if (customId === 'setup_config') {
      await interaction.deferReply({ ephemeral: true });
      // BUG-5 fix: getConfig là alias của getGuildConfig
      const cfg = await db.getConfig(guild.id);
      return interaction.editReply({ embeds: [buildConfigEmbed(cfg)] });
    }

    // Phân trang lịch sử
    if (customId?.startsWith('lichsu:')) {
      const parts    = customId.split(':');
      const action   = parts[1];
      const curPage  = parseInt(parts[2], 10);
      const newPage  = action === 'next' ? curPage + 1 : curPage - 1;
      await interaction.deferUpdate();
      const { buildHistoryPageEmbed, buildNavRow, PAGE_SIZE } = require('../src/commands/lichsu.js');
      // BUG-4 fix: getSessionHistory là alias của getRecentSessions
      const history     = await db.getSessionHistory(guild.id, 50);
      const totalPages  = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
      const clampedPage = Math.max(0, Math.min(newPage, totalPages - 1));
      return interaction.editReply({
        embeds: [buildHistoryPageEmbed(history, clampedPage, totalPages)],
        components: totalPages > 1 ? [buildNavRow(clampedPage, totalPages)] : [],
      });
    }

    // Xem danh sách
    if (customId === 'attend_view') {
      const session = await db.getActiveSession(guild.id);
      if (!session) return interaction.reply({ content: '🚫 Không có phiên điểm danh nào đang mở.', ephemeral: true });
      const attended = await db.getAttendances(session.id);
      return interaction.reply({ embeds: [await buildSessionEmbed(guild, session, attended)], ephemeral: true });
    }

    // Làm mới embed
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

    // Đóng phiên — hiện confirm prompt
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

    // Xác nhận đóng phiên
    if (customId === 'session:confirm_close') {
      const { channel } = interaction;
      await interaction.deferUpdate();
      const session = await db.getActiveSession(guild.id);
      if (!session) return interaction.editReply(replyErrEdit('🚫 Phiên đã được đóng trước đó.'));

      // BUG-8 fix: nếu closeSession throw → abort, không tiếp tục gửi embed
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

    // Hủy đóng phiên
    if (customId === 'session:cancel_close') {
      return interaction.update({ content: '↩️ Đã hủy. Phiên vẫn đang mở.', embeds: [], components: [] });
    }

    // Admin override button → mở modal
    // BUG-7 fix: handleAdminOverride tự gọi showModal (không deferReply trước)
    if (customId === 'admin:override') {
      const { handleAdminOverride } = require('../handlers/button/adminOverrideHandler.js');
      return handleAdminOverride(interaction);
    }

    // Upgrade confirm
    if (customId === 'upgrade:confirm') {
      await interaction.deferReply({ ephemeral: true });
      const { ok } = await requireAdmin(interaction, { context: 'nâng cấp cấu hình' });
      if (!ok) return;
      return interaction.editReply({
        content: [
          '⚙️ **Xác nhận nâng cấp cấu hình?**',
          '> Hành động này sẽ áp dụng thay đổi. Bấm lại lệnh `/setup` để tiếp tục hoặc bỏ qua nếu nhầm.',
        ].join('\n'),
        ephemeral: true,
      });
    }
  }
}

module.exports = { SessionButtonHandler };
