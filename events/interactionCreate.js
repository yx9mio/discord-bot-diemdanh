// events/interactionCreate.js — M-5: Router tập trung mọi interaction
'use strict';
const { handleCommand }          = require('../handlers/commandHandler.js');
const { handleButton }           = require('../handlers/buttonHandler.js');
const { handleSelectMenu }       = require('../commands/help.js');
const { handleSetupUi }          = require('../handlers/setupUiHandler.js');
const { handleUserPanelButton }  = require('../handlers/userPanelHandler.js');
const { handleInteractionError } = require('../utils/errorHandler.js');

module.exports = {
  name: 'interactionCreate',

  async execute(interaction, commands) {
    try {
      // ── Button ──────────────────────────────────────────────────────────────
      if (interaction.isButton()) {
        if (interaction.customId?.startsWith('toi:'))   return handleUserPanelButton(interaction);
        if (interaction.customId?.startsWith('setup:')) return handleSetupUi(interaction);
        return handleButton(interaction);
      }

      // ── Setup UI: RoleSelect / ChannelSelect / ModalSubmit ──────────────────
      if (
        interaction.isRoleSelectMenu()    ||
        interaction.isChannelSelectMenu() ||
        interaction.isModalSubmit()
      ) {
        if (interaction.customId?.startsWith('setup:')) return handleSetupUi(interaction);
      }

      // ── StringSelectMenu ────────────────────────────────────────────────────
      if (interaction.isStringSelectMenu()) {
        if (interaction.customId?.startsWith('setup:')) return handleSetupUi(interaction);
        return handleSelectMenu(interaction);
      }

      // ── Slash commands ──────────────────────────────────────────────────────
      if (interaction.isChatInputCommand()) return handleCommand(interaction, commands);

    } catch (err) {
      await handleInteractionError(interaction, err, 'interactionCreate');
    }
  },
};
