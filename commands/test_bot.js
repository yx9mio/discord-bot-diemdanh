'use strict';
// commands/test_bot.js
// Phase 1A: guard DEV_MODE — chỉ load trong môi trường dev
// Nếu NODE_ENV !== 'development', Sapphire sẽ không register command này
const { Command } = require('@sapphire/framework');

class TestBotCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'test_bot',
      description: '[DEV] Kiểm tra bot còn sống không',
      // Sapphire precondition: chỉ chạy trong development
      enabled: process.env.NODE_ENV === 'development',
    });
  }

  registerApplicationCommands(registry) {
    if (process.env.NODE_ENV !== 'development') return;
    registry.registerChatInputCommand(builder =>
      builder
        .setName('test_bot')
        .setDescription('[DEV] Kiểm tra bot còn sống không')
    );
  }

  async chatInputRun(interaction) {
    if (process.env.NODE_ENV !== 'development') {
      return interaction.reply({ content: '⛔ Lệnh này chỉ dùng trong môi trường dev.', ephemeral: true });
    }
    const { version } = require('../package.json');
    return interaction.reply({
      content: [
        '✅ **Bot đang hoạt động**',
        `> Version: \`${version}\``,
        `> Node: \`${process.version}\``,
        `> Uptime: \`${Math.round(process.uptime())}s\``,
        `> Guilds: \`${interaction.client.guilds.cache.size}\``,
        `> ENV: \`${process.env.NODE_ENV ?? 'undefined'}\``,
      ].join('\n'),
      ephemeral: true,
    });
  }
}

module.exports = { TestBotCommand };
