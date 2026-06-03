// src/commands/setup/setupCommand.js
// /setup — mở Bảng điều khiển (Smart Home dashboard).
// Đây là hub duy nhất cho mọi thao tác admin (Commit 3+4+5+6).
// Q1=b: thay thế toàn bộ admin slash commands.
// [FIX] module.exports = Class (không phải { Class }) để Sapphire load đúng
'use strict';
const { Command } = require('@sapphire/framework');
const { MessageFlags, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../../db.js');
const { HomeView } = require('./_HomeView.js');

class SetupCommand extends Command {
  constructor(context) {
    super(context, {
      name: 'setup',
      description: 'Mở Bảng điều khiển — quản lý lịch, thành viên, phiên, cài đặt',
      preconditions: ['AdminOnly'],
    });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Mở Bảng điều khiển — quản lý lịch, thành viên, phiên, cài đặt')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { guild } = interaction;
    const [cfg, schedules, members, session] = await Promise.all([
      db.getGuildConfig(guild.id),
      db.getScheduledSessions(guild.id),
      db.getMembers(guild.id),
      db.getActiveSession(guild.id),
    ]);
    const view = HomeView.render({ guild, cfg, schedules, members, session });
    return interaction.editReply(view);
  }
}

// [FIX] Export trực tiếp class — Sapphire yêu cầu module.exports = Class
module.exports = SetupCommand;
