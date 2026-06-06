// interaction-handlers/setup/setupConfig.js
// Handles: setup:cfg (mở Config view), setup:cfg:refresh
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { getGuildConfig } = require('../../services/configService.js');
const { ConfigView } = require('../../src/commands/setup/_views/_ConfigView.js'); // [FIX-SETUP]
const { CUSTOM_ID } = ConfigView;

class SetupConfigHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === 'setup:cfg' || id === CUSTOM_ID.REFRESH) return this.some();
    return this.none();
  }

  async run(interaction) {
    // [FIX] Thêm deferUpdate trước handleRefresh để tránh Discord 3s timeout.
    // handleRefresh bên trong ConfigView không tự defer, nên phải defer ở đây.
    if (interaction.customId === CUSTOM_ID.REFRESH) {
      await interaction.deferUpdate();
      return ConfigView.handleRefresh(interaction);
    }
    await interaction.deferUpdate();
    const cfg = await getGuildConfig(interaction.guild.id);
    return interaction.editReply(ConfigView.render({ cfg, guild: interaction.guild }));
  }
}

module.exports = { SetupConfigHandler };
