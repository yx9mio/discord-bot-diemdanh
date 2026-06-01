'use strict';
const { Command } = require('@sapphire/framework');

// ── Logic gốc ──────────────────────────────────────────────────────────────
// commands/status.js — M-3: Xem trạng thái bot, DB và phiên đang mở
'use strict';
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Xem trạng thái bot, DB và phiên điểm danh hiện tại'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild, client } = interaction;
    const session = await db.getActiveSession(guild.id);
    const uptime  = process.uptime();
    const h = Math.floor(uptime / 3600), m = Math.floor((uptime % 3600) / 60);

    const embed = new EmbedBuilder()
      .setColor(session ? 0x01696f : 0x7a7974)
      .setTitle('🤖 Trạng thái Bot')
      .addFields(
        { name: '🏓 Ping',    value: `${client.ws.ping}ms`, inline: true },
        { name: '⏱️ Uptime', value: `${h}h ${m}m`,         inline: true },
        { name: '🟢 Phiên',  value: session ? `**${session.session_name}** đang mở` : '_Không có phiên_', inline: false },
      ).setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
// ── Sapphire wrapper ──────────────────────────────────────────────────────────
const _origModule = module.exports;
class StatusCommand extends Command {
  constructor(context) { super(context, { name: _origModule.data.name, description: _origModule.data.description }); }
  registerApplicationCommands(registry) { registry.registerChatInputCommand(_origModule.data); }
  async chatInputRun(interaction) { return _origModule.execute(interaction); }
}
module.exports = { StatusCommand };
