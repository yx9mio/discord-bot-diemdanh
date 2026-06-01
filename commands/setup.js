'use strict';
const { Command } = require('@sapphire/framework');

// ── Logic gốc ──────────────────────────────────────────────────────────────
// commands/setup.js — Entry point: /setup mở Dashboard UI
'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Mở bảng điều khiển bot (Dashboard)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    // Delegate sang setupUiHandler hoặc reply hướng dẫn
    await interaction.reply({
      content: '⚙️ Dùng `/caidat`, `/caidatphai`, `/lichcodinh` để cấu hình bot.\n📊 Dùng `/quanlyphien` để quản lý phiên.',
      ephemeral: true,
    });
  },
};
// ── Sapphire wrapper ──────────────────────────────────────────────────────────
const _origModule = module.exports;
class SetupCommand extends Command {
  constructor(context) { super(context, { name: _origModule.data.name, description: _origModule.data.description, preconditions: ['AdminOnly'] }); }
  registerApplicationCommands(registry) { registry.registerChatInputCommand(_origModule.data); }
  async chatInputRun(interaction) { return _origModule.execute(interaction); }
}
module.exports = { SetupCommand };
