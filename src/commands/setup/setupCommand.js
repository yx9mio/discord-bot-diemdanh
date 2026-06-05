// src/commands/setup/setupCommand.js
// /setup — mở Bảng điều khiển (Smart Home dashboard).
// [FIX-SETUP] Import HomeView từ _views/ để tránh Sapphire scan _HomeView.js nhầm làm Command
'use strict';
const { Command } = require('@sapphire/framework');
const { MessageFlags, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const configService    = require('../../services/configService.js');
const scheduledService = require('../../services/scheduledService.js');
const memberService    = require('../../services/memberService.js');
const sessionService   = require('../../services/sessionService.js');
const { HomeView } = require('./_views/_HomeView.js'); // [FIX-SETUP] đường dẫn mới

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
      configService.getGuildConfig(guild.id),
      scheduledService.getScheduledSessions(guild.id),
      memberService.getMembers(guild.id),
      sessionService.getActiveSession(guild.id),
    ]);
    const view = HomeView.render({ guild, cfg, schedules, members, session });
    return interaction.editReply(view);
  }
}

// [FIX] Export trực tiếp class — Sapphire yêu cầu module.exports = Class
module.exports = SetupCommand;
