'use strict';
const { Command } = require('@sapphire/framework');

// ── Logic gốc ──────────────────────────────────────────────────────────────
// commands/test_bot.js — /test_bot: kiểm tra toàn bộ chức năng bot
'use strict';
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../db.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('test_bot')
    .setDescription('Kiểm tra kết nối DB và các tính năng cơ bản (Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const results = [];

    // Test DB ping
    try {
      await db.getGuildConfig(interaction.guild.id);
      results.push('✅ DB: Kết nối OK');
    } catch (e) {
      results.push(`❌ DB: ${e.message}`);
    }

    // Test getActiveSession
    try {
      const s = await db.getActiveSession(interaction.guild.id);
      results.push(s ? `✅ Phiên đang mở: ${s.session_name}` : '✅ Không có phiên đang mở');
    } catch (e) {
      results.push(`❌ getActiveSession: ${e.message}`);
    }

    // Bot info
    results.push(`✅ Bot: ${interaction.client.user.tag}`);
    results.push(`✅ Ping: ${interaction.client.ws.ping}ms`);

    const embed = new EmbedBuilder()
      .setColor(0x437a22)
      .setTitle('🧪 Kết quả Test Bot')
      .setDescription(results.join('\n'))
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
// ── Sapphire wrapper ──────────────────────────────────────────────────────────
const _origModule = module.exports;
class TestBotCommand extends Command {
  constructor(context) { super(context, { name: _origModule.data.name, description: _origModule.data.description, preconditions: ['AdminOnly'] }); }
  registerApplicationCommands(registry) { registry.registerChatInputCommand(_origModule.data); }
  async chatInputRun(interaction) { return _origModule.execute(interaction); }
}
module.exports = { TestBotCommand };
