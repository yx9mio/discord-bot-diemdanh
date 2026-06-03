// interaction-handlers/helpPage.js
// Xử lý nút chuyển trang trên /help.

'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { HelpCommand, CUSTOM_ID } = require('../src/commands/general/help.js');

class HelpPageHandler extends InteractionHandler {
  constructor(ctx) {
    super(ctx, {
      interactionHandlerType: InteractionHandlerTypes.Button,
    });
  }

  parse(interaction) {
    if (!Object.values(CUSTOM_ID).includes(interaction.customId)) return this.none();
    return this.some();
  }

  run(interaction) {
    const audience = interaction.customId === CUSTOM_ID.ADMIN_PAGE ? 'admin' : 'user';
    return HelpCommand.render(audience, interaction);
  }
}

module.exports = { HelpPageHandler };
