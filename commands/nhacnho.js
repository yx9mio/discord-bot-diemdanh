'use strict';
const { Command } = require('@sapphire/framework');

// ── Logic gốc ──────────────────────────────────────────────────────────────
// commands/nhacnho.js
'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../db.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nhacnho')
    .setDescription('Bật/tắt nhắc nhở điểm danh tự động')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption(o => o.setName('bat').setDescription('true = bật, false = tắt').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const enabled = interaction.options.getBoolean('bat');
    await db.setGuildConfig(interaction.guild.id, { reminder_enabled: enabled });
    await interaction.editReply({ content: enabled ? '✅ Đã bật nhắc nhở điểm danh.' : '🔕 Đã tắt nhắc nhở điểm danh.' });
  },
};
// ── Sapphire wrapper ──────────────────────────────────────────────────────────
const _origModule = module.exports;
class NhacnhoCommand extends Command {
  constructor(context) { super(context, { name: _origModule.data.name, description: _origModule.data.description, preconditions: ['AdminOnly'] }); }
  registerApplicationCommands(registry) { registry.registerChatInputCommand(_origModule.data); }
  async chatInputRun(interaction) { return _origModule.execute(interaction); }
}
module.exports = { NhacnhoCommand };
