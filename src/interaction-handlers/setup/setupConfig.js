// src/interaction-handlers/setup/setupConfig.js
// Handles: setup:cfg (mở Config view), setup:cfg:refresh
// [FIX-PATH] ../../../services/ (3 cấp từ src/interaction-handlers/setup/)
// [FIX-DEFER] deferUpdate thay vì deferReply
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { getGuildConfig } = require('../../../services/configService.js');
const { ConfigView } = require('../../commands/setup/_views/_ConfigView.js');
const { CUSTOM_ID } = ConfigView;

class SetupConfigHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (interaction.customId === CUSTOM_ID.CFG || interaction.customId === CUSTOM_ID.REFRESH) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferUpdate();
    const cfg = await getGuildConfig(interaction.guild.id);
    return interaction.editReply(ConfigView.render(cfg));
  }
}

module.exports = { SetupConfigHandler };
