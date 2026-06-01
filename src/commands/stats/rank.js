// src/commands/stats/rank.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder } = require('discord.js');
const db = require('../../db.js');
const { buildRankEmbed } = require('../../utils/embeds.js');

class RankCommand extends Command {
  constructor(context) {
    super(context, { name: 'rank', description: 'Bảng xếp hạng điểm danh server' });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Bảng xếp hạng điểm danh server')
        .addIntegerOption(o => o.setName('top').setDescription('Top N (mặc định 10)').setRequired(false).setMinValue(3).setMaxValue(25))
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply();
    const topN  = interaction.options.getInteger('top') ?? 10;
    const rows  = await db.getRankRows(interaction.guild.id, topN);
    const embed = buildRankEmbed(rows, interaction.guild);
    await interaction.editReply({ embeds: [embed] });
  }
}

module.exports = { RankCommand };
