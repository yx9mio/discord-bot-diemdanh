'use strict';
const { Command } = require('@sapphire/framework');

// ── Logic gốc ──────────────────────────────────────────────────────────────
// commands/toi.js — /toi: Xem thống kê điểm danh cá nhân
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { buildPersonalStatsEmbed } = require('../utils/embeds.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('toi')
    .setDescription('Xem thống kê điểm danh cá nhân của bạn'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const stats = await db.getUserStats(interaction.guild.id, interaction.user.id);
    const embed = buildPersonalStatsEmbed(interaction.user, stats);
    await interaction.editReply({ embeds: [embed] });
  },
};
// ── Sapphire wrapper ──────────────────────────────────────────────────────────
const _origModule = module.exports;
class ToiCommand extends Command {
  constructor(context) { super(context, { name: _origModule.data.name, description: _origModule.data.description }); }
  registerApplicationCommands(registry) { registry.registerChatInputCommand(_origModule.data); }
  async chatInputRun(interaction) { return _origModule.execute(interaction); }
}
module.exports = { ToiCommand };
