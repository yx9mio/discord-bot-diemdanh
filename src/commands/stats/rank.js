// src/commands/stats/rank.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder } = require('discord.js');
const db = require('../../../db.js');
const { buildRankEmbed } = require('../../../utils/embeds.js');

class RankCommand extends Command {
  constructor(context) {
    super(context, { name: 'rank', description: 'Xem bảng xếp hạng top thành viên điểm danh' });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Xem bảng xếp hạng top thành viên điểm danh')
        .addIntegerOption(o => o.setName('top').setDescription('Số người hiển thị (mặc định 10)').setRequired(false).setMinValue(1).setMaxValue(25))
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply();
    const topN  = interaction.options.getInteger('top') ?? 10;
    const all   = await db.getAllMemberStats(interaction.guild.id);
    const embed = buildRankEmbed(all, interaction.guild, topN);
    await interaction.editReply({ embeds: [embed] });
  }
}

module.exports = { RankCommand };
