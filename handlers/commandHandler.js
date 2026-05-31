// handlers/commandHandler.js
const path = require('path');
const fs   = require('fs');
const log  = require('../utils/logger.js');

function loadCommands() {
  const dir = path.join(__dirname, '..', 'commands');
  const commands = new Map();
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
    const cmd = require(path.join(dir, file));
    if (cmd.data && cmd.execute) commands.set(cmd.data.name, cmd);
  }
  return commands;
}

async function handleCommand(interaction, commands) {
  const cmd = commands.get(interaction.commandName);
  if (!cmd) return;
  try {
    await cmd.execute(interaction);
  } catch (err) {
    log.error('CMD', interaction.guildId, 'Lỗi lệnh /%s: %s', interaction.commandName, err.stack ?? err.message);
    const reply = { content: '❌ Có lỗi xảy ra. Vui lòng thử lại.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      interaction.editReply(reply).catch(() => {});
    } else {
      interaction.reply(reply).catch(() => {});
    }
  }
}

module.exports = { loadCommands, handleCommand };
