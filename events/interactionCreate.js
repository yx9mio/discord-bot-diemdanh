// events/interactionCreate.js
const { handleCommand } = require('../handlers/commandHandler.js');
const { handleButton }  = require('../handlers/buttonHandler.js');
const { handleSelectMenu } = require('../commands/help.js');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, commands) {
    if (interaction.isChatInputCommand()) {
      return handleCommand(interaction, commands);
    }
    if (interaction.isButton()) {
      return handleButton(interaction);
    }
    if (interaction.isStringSelectMenu()) {
      return handleSelectMenu(interaction);
    }
  },
};
