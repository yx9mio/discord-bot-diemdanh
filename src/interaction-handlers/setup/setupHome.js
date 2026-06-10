'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { getGuildConfig } = require('../../../services/configService.js');
const { getScheduledSessions } = require('../../../services/scheduledService.js');
const { getMembers } = require('../../../services/memberService.js');
const { getActiveSessions } = require('../../../services/sessionService.js');
const { HomeView } = require('../../commands/setup/_views/_HomeView.js');
const { CUSTOM_ID } = HomeView;

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
    await interaction.deferUpdate();
    const { guild } = interaction;
    const [cfg, schedules, members, sessions] = await Promise.all([
      getGuildConfig(guild.id),
      getScheduledSessions(guild.id),
      getMembers(guild.id),
      getActiveSessions(guild.id),
    ]);
    return interaction.editReply(HomeView.render({ guild, cfg, schedules, members, sessions }));
  }
}

module.exports = { SetupHomeHandler };
