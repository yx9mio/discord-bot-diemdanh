// src/commands/toi.js
'use strict';
const { Command } = require('@sapphire/framework');
const { MessageFlags } = require('discord.js');
const db = require('../../db.js');
const { buildPersonalStatsEmbed } = require('../../utils/embeds.js');

class ToiCommand extends Command {
  constructor(context) {
    super(context, { name: 'toi', description: 'Xem thống kê điểm danh cá nhân của bạn' });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(builder =>
      builder.setName('toi').setDescription('Xem thống kê điểm danh cá nhân của bạn')
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const stats = await db.getUserStats(interaction.guild.id, interaction.user.id);
    const embed = buildPersonalStatsEmbed(interaction.user, stats);
    await interaction.editReply({ embeds: [embed] });
  }
}

module.exports = { ToiCommand };
