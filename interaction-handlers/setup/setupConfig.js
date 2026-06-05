// interaction-handlers/setup/setupConfig.js
// Handles: setup:cfg (mở Config view)
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { getGuildConfig } = require('../../services/configService.js');
const { ConfigView } = require('../../src/commands/setup/_ConfigView.js');

class SetupConfigHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (interaction.customId === 'setup:cfg') return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferUpdate();
    const { guild } = interaction;
    const cfg = await getGuildConfig(guild.id);
    const view = ConfigView.render({ cfg, guild });
    return interaction.editReply(view);
  }
}

module.exports = { SetupConfigHandler };
