// interaction-handlers/setup/setupSession.js
// Handles: setup:session (mở Session view)
// [FIX-PATH] ../../../ → ../../../../
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const sessionService = require('../../services/sessionService.js');
const { getGuildConfig } = require('../../services/configService.js');
const { getMembers } = require('../../services/memberService.js');

const SESSION_ENTRY_ID = 'setup:session';

class SetupSessionHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (interaction.customId === SESSION_ENTRY_ID) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferUpdate();
    const { guild } = interaction;
    const [session, cfg, members] = await Promise.all([
      sessionService.getActiveSession(guild.id),
      getGuildConfig(guild.id),
      getMembers(guild.id),
    ]);
    const { SessionView } = require('../../commands/setup/_views/_SessionView.js');
    return interaction.editReply(SessionView.render({ guild, session, cfg, members }));
  }
}

module.exports = { SetupSessionHandler };
