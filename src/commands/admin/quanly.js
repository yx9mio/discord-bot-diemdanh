// src/commands/admin/quanly.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

class QuanLyCommand extends Command {
  constructor(context) {
    super(context, { name: 'quanly', description: 'Bảng điều khiển quản lý bot', preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('quanly')
        .setDescription('Mở bảng điều khiển quản lý bot (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    );
  }

  async chatInputRun(interaction) {
    await interaction.reply({
      content: '🛠️ Sử dụng `/quanlyphien` để quản lý phiên, `/caidat` để cài đặt bot, `/log` để xem log.',
      ephemeral: true,
    });
  }
}

module.exports = { QuanLyCommand };
