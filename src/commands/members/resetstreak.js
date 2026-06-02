// src/commands/members/resetstreak.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { replyConfirm } = require('../../../utils/embeds.js');

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
    const target = interaction.options.getUser('thanh_vien');

    return interaction.editReply(
      replyConfirm(
        `Reset streak của <@${target.id}> về 0?\n> Lịch sử điểm danh vẫn được giữ nguyên.`,
        `resetstreak:confirm:${target.id}`,
        `resetstreak:cancel:${target.id}`,
      ),
    );
  }
}

module.exports = { ResetStreakCommand };
