// src/interaction-handlers/setup/setupStatsLichsu.js
// [BUG-4] NEW — Handler pagination lịch sử: lichsu:prev / lichsu:next
// [BUG-A] Fix import path: ../../../services/ (3 cấp lên /app/)
// [BUG-D] Đọc targetUserId từ embed description thay vì luôn dùng interaction.user.id
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { getAttendancesByUser } = require('../../../services/attendanceService.js');
const log = require('../../../utils/logger.js');
const { StatsView } = require('../../commands/setup/_views/_StatsView.js');

const LICHSU_PREV = 'setup:stats:lichsu:prev';
const LICHSU_NEXT = 'setup:stats:lichsu:next';

class SetupStatsLichsuHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (interaction.customId === LICHSU_PREV || interaction.customId === LICHSU_NEXT)
      return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferUpdate();
    const { guild, customId } = interaction;

    let currentPage = 0;
    try {
      const footer = interaction.message?.embeds?.[0]?.footer?.text ?? '';
      const match  = footer.match(/Trang (\d+)\/(\d+)/);
      if (match) currentPage = parseInt(match[1], 10) - 1;
    } catch { /* fallback page 0 */ }

    // [BUG-D] Đọc targetUserId từ embed description để admin xem người khác không bị nhảy về mình
    let targetUserId = interaction.user.id;
    try {
      const desc = interaction.message?.embeds?.[0]?.description ?? '';
      const mentionMatch = desc.match(/<@!?(\d+)>/);
      if (mentionMatch) targetUserId = mentionMatch[1];
    } catch { /* giữ interaction.user.id nếu parse lỗi */ }

    const nextPage = customId === LICHSU_NEXT ? currentPage + 1 : currentPage - 1;

    try {
      const records = await getAttendancesByUser(guild.id, targetUserId);
      return interaction.editReply(StatsView.renderLichSu(records, targetUserId, guild, nextPage));
    } catch (e) {
      log.error('STATS_LICHSU', guild.id, 'pagination thất bại: %s', e.message);
      return interaction.editReply({ content: '❌ Không thể tải trang, thử lại sau.' });
    }
  }
}

module.exports = { SetupStatsLichsuHandler };
