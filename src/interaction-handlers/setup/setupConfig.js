// src/interaction-handlers/setup/setupConfig.js
// Handles: setup:cfg (mở Config view), setup:cfg:refresh
// [FIX-PATH] ../../../services/ (3 cấp từ src/interaction-handlers/setup/)
// [FIX-DEFER] deferUpdate thay vì deferReply
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { getGuildConfig } = require('../../../services/configService.js');
const { ConfigView } = require('../../commands/setup/_views/_ConfigView.js');
const { wrapHandler } = require('../../../utils/error-boundary.js');

class SetupConfigHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (interaction.customId === 'setup:cfg' || interaction.customId === 'setup:cfg:refresh') return this.some();
    return this.none();
  }

  async run(interaction) {
    return wrapHandler(async (interaction) => {
    await interaction.deferUpdate();
    const cfg = await getGuildConfig(interaction.guild.id);
    ConfigView.storeMessageId(interaction.guild.id, interaction.message.id);
    return interaction.editReply(ConfigView.render({ cfg, guild: interaction.guild }));
  }, 'SetupConfigHandler')(interaction); }
}

module.exports = { SetupConfigHandler };
