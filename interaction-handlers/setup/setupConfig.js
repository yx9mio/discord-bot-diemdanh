// interaction-handlers/setup/setupConfig.js
// Handles: setup:cfg (mở Config view)
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const db = require('../../db.js');
const { ConfigView } = require('../../src/commands/setup/_ConfigView.js');

class SetupConfigHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    // [DEBUG] log mọi button interaction để xác nhận handler nhận được
    console.log('[DEBUG] setupConfig parse() called, customId:', interaction.customId);
    if (interaction.customId === 'setup:cfg') return this.some();
    return this.none();
  }

  async run(interaction) {
    console.log('[DEBUG] setupConfig run() called');
    await interaction.deferUpdate();
    const { guild } = interaction;
    const cfg = await db.getGuildConfig(guild.id);
    const view = ConfigView.render({ cfg, guild });
    return interaction.editReply(view);
  }
}

module.exports = { SetupConfigHandler };
