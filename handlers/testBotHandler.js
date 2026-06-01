'use strict';
// handlers/testBotHandler.js
// Phase 1A: guard DEV_MODE
// File này chỉ được require từ commands/test_bot.js (legacy path)
// Trong môi trường production, không được gọi

if (process.env.NODE_ENV !== 'development') {
  module.exports = { handleTestBot: async () => {} };
} else {
  const log = require('./logger.js') ?? require('../utils/logger.js');
  async function handleTestBot(interaction) {
    const { version } = require('../package.json');
    return interaction.reply({
      content: [
        '✅ **Bot đang hoạt động**',
        `> Version: \`${version}\``,
        `> Node: \`${process.version}\``,
        `> Uptime: \`${Math.round(process.uptime())}s\``,
        `> Guilds: \`${interaction.client.guilds.cache.size}\``,
      ].join('\n'),
      ephemeral: true,
    });
  }
  module.exports = { handleTestBot };
}
