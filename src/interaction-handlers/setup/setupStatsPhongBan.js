'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { getTopMembers, getDistinctPhongBan } = require('../../../services/memberService.js');
const log = require('../../../utils/logger.js');
const { StatsView } = require('../../commands/setup/_views/_StatsView.js');
const { wrapHandler } = require('../../../utils/error-boundary.js');

class SetupStatsPhongBanHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.SelectMenu });
  }

  parse(interaction) {
    if (interaction.customId === StatsView.CUSTOM_ID.PHONG_BAN_SELECT) return this.some();
    return this.none();
  }

  async run(interaction) {
    return wrapHandler(async (interaction) => {
    await interaction.deferUpdate();
    const { guild } = interaction;
    const selectedPhongBan = interaction.values[0] === '__all' ? '' : interaction.values[0];

    try {
      const [top, pbList] = await Promise.all([
        getTopMembers(guild.id, 10, selectedPhongBan || null),
        getDistinctPhongBan(guild.id),
      ]);
      return interaction.editReply(await StatsView.renderRank(top, guild, 10, pbList, selectedPhongBan));
    } catch (e) {
      log.error('SETUP_STATS_PB', guild.id, 'phòng ban filter thất bại: %s', e.message);
      return interaction.editReply({ content: '❌ Không thể lọc theo phòng ban, thử lại sau.', embeds: [], files: [] });
    }
  }, 'SetupStatsPhongBanHandler')(interaction); }
}

module.exports = { SetupStatsPhongBanHandler };
