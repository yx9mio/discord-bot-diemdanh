'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { getGuildConfig } = require('../../../services/configService.js');
const { getScheduledSessions } = require('../../../services/scheduledService.js');
const { getMembers } = require('../../../services/memberService.js');
const { getActiveSessions } = require('../../../services/sessionService.js');
const attendanceService = require('../../../services/attendanceService.js');
const { HomeView } = require('../../commands/setup/_views/_HomeView.js');
const { CUSTOM_ID } = HomeView;
const log = require('../../../utils/logger.js');
const { wrapHandler } = require('../../../utils/error-boundary.js');
const { checkCooldown } = require('../../../utils/cooldown.js');

class SetupHomeHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === CUSTOM_ID.HOME || id === CUSTOM_ID.REFRESH) return this.some();
    return this.none();
  }

  async run(interaction) {
    return wrapHandler(async (interaction) => {
    await interaction.deferUpdate();
    if (!checkCooldown(interaction.user.id, 'setup_home', 1000)) return interaction.editReply({ content: '⏳ Vui lòng đợi một chút trước khi thực hiện hành động này.' });
    const { guild } = interaction;
    try {
      const [cfg, schedules, members, sessions] = await Promise.all([
        getGuildConfig(guild.id),
        getScheduledSessions(guild.id),
        getMembers(guild.id),
        getActiveSessions(guild.id),
      ]);
      const attendances = sessions?.length
        ? await attendanceService.getAttendances(sessions[0].id)
        : [];
      return interaction.editReply(HomeView.render({ guild, cfg, schedules, members, sessions, attendances }));
    } catch (e) {
      log.error('SETUP_HOME', guild.id, 'Dashboard load thất bại: %s', e.message);
      return interaction.editReply(HomeView.renderError({ guild, reason: e.message }));
    }
  }, 'SetupHomeHandler')(interaction); }
}

module.exports = { SetupHomeHandler };
