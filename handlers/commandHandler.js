'use strict';

/**
 * commandHandler.js — load & dispatch slash commands
 */
const fs  = require('fs');
const path = require('path');

/**
 * loadCommands — đọc tất cả file trong commands/ và trả về Map<name, module>
 * @param {string} [commandsDir]  đường dẫn thư mục commands (mặc định <root>/commands)
 * @returns {Map<string, object>}
 */
function loadCommands(commandsDir) {
  const dir = commandsDir ?? path.join(__dirname, '..', 'commands');
  const commands = new Map();
  if (!fs.existsSync(dir)) return commands;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    try {
      const mod = require(path.join(dir, file));
      const name = mod.data?.name ?? mod.name ?? path.basename(file, '.js');
      if (name) commands.set(name, mod);
    } catch (_e) { /* bỏ qua file lỗi */ }
  }
  return commands;
}

/**
 * handleCommand — dispatch interaction tới command tương ứng
 * @param {Map}    commands
 * @param {object} interaction  Discord.js ChatInputCommandInteraction
 */
async function handleCommand(commands, interaction) {
  if (!interaction?.commandName) return;
  const cmd = commands.get(interaction.commandName);
  if (!cmd) return;
  try {
    await cmd.execute(interaction);
  } catch (e) {
    const msg = { content: '❌ Có lỗi khi thực thi lệnh.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg).catch(() => null);
    } else {
      await interaction.reply(msg).catch(() => null);
    }
  }
}

module.exports = { loadCommands, handleCommand };
