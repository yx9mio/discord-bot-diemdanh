// src/interaction-handlers/setup/setupStatsLichsu.js
// [FIX-PATH] ../../../services/ (3 cấp, không phải 4)
// [FIX] Đọc targetUserId từ footer `uid:XXXXXXX` để phân trang đúng khi admin xem người khác
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { getAttendancesByUser } = require('../../../services/attendanceService.js');
const log = require('../../../utils/logger.js');
const { StatsView } = require('../../commands/setup/_views/_StatsView.js');
const { wrapHandler } = require('../../../utils/error-boundary.js');

const LICHSU_NEXT = 'setup:stats:lichsu:next';
const LICHSU_PREV = 'setup:stats:lichsu:prev';

class SetupStatsLichsuHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (interaction.customId === LICHSU_NEXT || interaction.customId === LICHSU_PREV) return this.some();
    return this.none();
  }

  async run(interaction) {
    return wrapHandler(async (interaction) => {
    await interaction.deferUpdate();
    const { guild, customId } = interaction;

    try {
      // [FIX] Đọc targetUserId từ footer để phân trang đúng khi admin xem người khác
      const footer = interaction.message?.embeds?.[0]?.footer?.text ?? '';
      const uidMatch = footer.match(/uid:(\d{10,20})/);
      const targetUserId = uidMatch ? uidMatch[1] : interaction.user.id;

      // Đọc trang hiện tại từ footer
      let currentPage = 0;
      const pageMatch = footer.match(/Trang (\d+)\/(\d+)/);
      if (pageMatch) currentPage = parseInt(pageMatch[1], 10) - 1;

      const nextPage = customId === LICHSU_NEXT ? currentPage + 1 : currentPage - 1;

      let records = await getAttendancesByUser(guild.id, targetUserId);
      if (!Array.isArray(records)) records = [];
      return interaction.editReply(await StatsView.renderLichSu(records, targetUserId, guild, nextPage));
    } catch (e) {
      log.error('STATS_LICHSU', guild?.id, 'pagination thất bại: %s', e.message);
      return interaction.editReply({ content: '❌ Không thể tải trang, thử lại sau.' });
    }
  }, 'SetupStatsLichsuHandler')(interaction); }
}

module.exports = { SetupStatsLichsuHandler };
