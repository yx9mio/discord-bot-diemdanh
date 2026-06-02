'use strict';

/**
 * commandHandler.js — load & dispatch slash commands
 */
const fs   = require('fs');
const path = require('path');

/**
 * loadCommands — đọc tất cả file .js trong commands/ và trả về Map<name, module>
 * Tìm thư mục theo thứ tự ưu tiên:
 *   1. commandsDir tham số truyền vào
 *   2. <root>/src/commands  (cấu trúc hiện tại)
 *   3. <root>/commands      (fallback)
 * @param {string} [commandsDir]
 * @returns {Map<string, object>}
 */
function loadCommands(commandsDir) {
  const root = path.join(__dirname, '..');
  const candidates = commandsDir
    ? [commandsDir]
    : [
        path.join(root, 'src', 'commands'),
        path.join(root, 'commands'),
      ];

  const dir = candidates.find(d => fs.existsSync(d));
  if (!dir) return new Map();

  const commands = new Map();

  function walk(currentDir) {
    let entries;
    try { entries = fs.readdirSync(currentDir, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      const full = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.js') && entry.name !== 'test_bot.js') {
        try {
          const mod  = require(full);
          const name = mod.data?.name ?? mod.name ?? path.basename(entry.name, '.js');
          if (name && !commands.has(name)) commands.set(name, mod);
        } catch { /* bỏ qua file lỗi */ }
      }
    }
  }

  walk(dir);
  return commands;
}

/**
 * handleCommand — dispatch interaction tới command tương ứng
 * Lưu ý: thứ tự tham số là (interaction, commands) để khớp với test.
 * @param {object} interaction  Discord.js ChatInputCommandInteraction
 * @param {Map}    commands
 */
async function handleCommand(interaction, commands) {
  if (!interaction?.commandName) return;
  const cmd = commands.get(interaction.commandName);
  if (!cmd) return;
  try {
    await cmd.execute(interaction);
  } catch (_e) {
    const msg = { content: '❌ Có lỗi khi thực thi lệnh.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg).catch(() => null);
    } else {
      await interaction.reply(msg).catch(() => null);
    }
  }
}

module.exports = { loadCommands, handleCommand };
