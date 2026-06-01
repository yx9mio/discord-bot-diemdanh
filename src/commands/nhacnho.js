// src/commands/nhacnho.js
'use strict';
const { Command } = require('@sapphire/framework');
const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../db.js');

class NhacnhoCommand extends Command {
  constructor(context) {
    super(context, { name: 'nhacnho', description: 'Bật/tắt nhắc nhở điểm danh tự động', preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(builder =>
      builder
        .setName('nhacnho')
        .setDescription('Bật/tắt nhắc nhở điểm danh tự động')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addBooleanOption(o => o.setName('bat').setDescription('true = bật, false = tắt').setRequired(true))
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const enabled = interaction.options.getBoolean('bat');
    await db.setGuildConfig(interaction.guild.id, { reminder_enabled: enabled });
    await interaction.editReply({ content: enabled ? '✅ Đã bật nhắc nhở điểm danh.' : '🔕 Đã tắt nhắc nhở điểm danh.' });
  }
}

module.exports = { NhacnhoCommand };
