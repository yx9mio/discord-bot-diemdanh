// interaction-handlers/setup/setupHome.js
// Handles: setup:home, setup:home:refresh
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { getGuildConfig } = require('../../../services/configService.js');
const { getScheduledSessions } = require('../../../services/scheduledService.js');
const { getMembers } = require('../../../services/memberService.js');
const { getActiveSession } = require('../../../services/sessionService.js');
const { HomeView } = require('../../commands/setup/_views/_HomeView.js'); // [FIX-SETUP]
const { CUSTOM_ID } = HomeView;

const KNOWN_IDS = new Set([
  CUSTOM_ID.HOME,
  CUSTOM_ID.REFRESH,
]);

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
    const [cfg, schedules, members, session] = await Promise.all([
      getGuildConfig(guild.id),
      getScheduledSessions(guild.id),
      getMembers(guild.id),
      getActiveSession(guild.id),
    ]);
    const view = HomeView.render({ guild, cfg, schedules, members, session });
    return interaction.editReply(view);
  }
}

module.exports = { SetupHomeHandler, KNOWN_IDS };
