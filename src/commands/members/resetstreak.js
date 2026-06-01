// src/commands/members/resetstreak.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../db.js');

class ResetStreakCommand extends Command {
  constructor(context) {
    super(context, { name: 'resetstreak', description: 'Reset streak điểm danh của thành viên', preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('resetstreak')
        .setDescription('Reset streak điểm danh của thành viên')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addUserOption(o => o.setName('thanh_vien').setDescription('Thành viên cần reset streak').setRequired(true))
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;
    const target = interaction.options.getUser('thanh_vien');

    await db.resetStreak(guild.id, target.id);

    const embed = new EmbedBuilder()
      .setColor(0xda7101)
      .setTitle('🔄 Đã reset streak')
      .setDescription(`Streak của <@${target.id}> đã được đặt về 0.`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

module.exports = { ResetStreakCommand };
