'use strict';
const { Command } = require('@sapphire/framework');

// ── Logic gốc ──────────────────────────────────────────────────────────────
// commands/rank.js
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { buildRankEmbed } = require('../utils/embeds.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Bảng xếp hạng điểm danh server')
    .addIntegerOption(o => o.setName('top').setDescription('Top N (mặc định 10)').setRequired(false).setMinValue(3).setMaxValue(25)),

  async execute(interaction) {
    await interaction.deferReply();
    const topN  = interaction.options.getInteger('top') ?? 10;
    const rows  = await db.getRankRows(interaction.guild.id, topN);
    const embed = buildRankEmbed(rows, interaction.guild);
    await interaction.editReply({ embeds: [embed] });
  },
};
// ── Sapphire wrapper ──────────────────────────────────────────────────────────
const _origModule = module.exports;
class RankCommand extends Command {
  constructor(context) { super(context, { name: _origModule.data.name, description: _origModule.data.description }); }
  registerApplicationCommands(registry) { registry.registerChatInputCommand(_origModule.data); }
  async chatInputRun(interaction) { return _origModule.execute(interaction); }
}
module.exports = { RankCommand };
