// interaction-handlers/setup/setupHistory.js
// Handles: setup:history (mở History view)
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { HistoryView } = require('../../commands/setup/_views/_HistoryView.js'); // [FIX-SETUP]

class SetupHistoryHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === 'setup:history' || id === HistoryView.CUSTOM_ID?.REFRESH) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferUpdate();
    return HistoryView.handleInteraction(interaction);
  }
}

module.exports = { SetupHistoryHandler };
