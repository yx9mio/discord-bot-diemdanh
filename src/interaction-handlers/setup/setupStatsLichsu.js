// src/interaction-handlers/setup/setupStatsLichsu.js
// [FIX] Đọc targetUserId từ footer `uid:XXXXXXX`
// [FIX-PATH] ../../../../services/ và ../../../../utils/
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { getAttendancesByUser } = require('../../../../services/attendanceService.js');
const log = require('../../../../utils/logger.js');
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

    let targetUserId = interaction.user.id;
    try {
      const footer = interaction.message?.embeds?.[0]?.footer?.text ?? '';
      const uidMatch = footer.match(/uid:(\d{10,20})/);
      if (uidMatch) targetUserId = uidMatch[1];
    } catch { /* giữ interaction.user.id */ }

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
