// src/commands/resetstreak.js
'use strict';
const { Command } = require('@sapphire/framework');
const { PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../db.js');

class ResetstreakCommand extends Command {
  constructor(context) {
    super(context, { name: 'resetstreak', description: 'Reset streak của một hoặc tất cả thành viên', preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(builder =>
      builder
        .setName('resetstreak')
        .setDescription('Reset streak của một hoặc tất cả thành viên (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(s =>
          s.setName('thanh_vien').setDescription('Reset streak của một thành viên')
            .addUserOption(o => o.setName('user').setDescription('Thành viên').setRequired(true))
        )
        .addSubcommand(s => s.setName('tat_ca').setDescription('Reset streak toàn bộ server (⚠️ không hoàn tác)'))
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const sub = interaction.options.getSubcommand();
    const { guild } = interaction;

    if (sub === 'thanh_vien') {
      const user = interaction.options.getUser('user');
      await db.resetStreak(guild.id, user.id);
      return interaction.editReply({ content: `✅ Đã reset streak của <@${user.id}>.` });
    }
    if (sub === 'tat_ca') {
      await db.resetAllStreaks(guild.id);
      const embed = new EmbedBuilder().setColor(0xa12c7b).setTitle('⚠️ Reset Streak Toàn Server').setDescription('Đã reset streak toàn bộ thành viên.').setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }
  }
}

module.exports = { ResetstreakCommand };
