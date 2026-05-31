// handlers/commandHandler.js
const { Collection } = require('discord.js');
const path = require('path');
const fs   = require('fs');

// Load tất cả command từ thư mục commands/
function loadCommands() {
  const commands = new Collection();
  const dir = path.join(__dirname, '..', 'commands');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const cmd = require(path.join(dir, file));
    if (cmd.data && cmd.execute) {
      commands.set(cmd.data.name, cmd);
    }
  }
  return commands;
}

async function handleCommand(interaction, commands) {
  const cmd = commands.get(interaction.commandName);
  if (!cmd) return;
  try {
    await cmd.execute(interaction);
  } catch (err) {
    console.error(`[Quản Gia] Lỗi lệnh /${interaction.commandName}:`, err);
    const msg = { content: '⚠️ Đã xảy ra lỗi khi thực hiện lệnh này.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(msg).catch(() => null);
    } else {
      await interaction.reply(msg).catch(() => null);
    }
  }
}

module.exports = { loadCommands, handleCommand };
