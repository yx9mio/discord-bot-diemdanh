// interaction-handlers/setup/setupConfig.js
// Handles: setup:cfg (mở Config view)
// (Commit 4: chỉ render. Commit 5 sẽ thêm handlers cho 4 nút edit.)
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const db = require('../../db.js');
const { ConfigView } = require('../../src/commands/setup/ConfigView.js');
const { CUSTOM_ID } = ConfigView;

class SetupConfigHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (interaction.customId === CUSTOM_ID.BACK_HOME) return this.some();
    if (interaction.customId === 'setup:cfg') return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferUpdate();
    const { guild } = interaction;
    const cfg = await db.getGuildConfig(guild.id);
    const view = ConfigView.render({ cfg, guild });
    return interaction.editReply(view);
  }
}

module.exports = { SetupConfigHandler };
