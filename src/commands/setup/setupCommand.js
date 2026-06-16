// src/commands/setup/setupCommand.js
// /setup — mở Bảng điều khiển (Smart Home dashboard).
// [FIX-SETUP] Import HomeView từ _views/ để tránh Sapphire scan _HomeView.js nhầm làm Command
'use strict';
const { Command } = require('@sapphire/framework');
const { MessageFlags, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const configService    = require('../../../services/configService.js');
const scheduledService = require('../../../services/scheduledService.js');
const memberService    = require('../../../services/memberService.js');
const { getActiveSessions } = require('../../../services/sessionService.js');
const log = require('../../../utils/logger.js');
const { HomeView } = require('./_views/_HomeView.js'); // [FIX-SETUP] đường dẫn mới

class SetupCommand extends Command {
  constructor(context) {
    super(context, {
      name: 'setup',
      description: 'Mở Bảng điều khiển — quản lý lịch, thành viên, Bang Chiến, cài đặt',
      preconditions: ['AdminOnly'],
    });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Mở Bảng điều khiển — quản lý lịch, thành viên, Bang Chiến, cài đặt')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    );
  }

  async chatInputRun(interaction) {
    // [FIX] Guard stale interaction (40060) xảy ra khi bot restart đúcng lúc user gọi lệnh
    // Discord có thể deliver cùng 1 interaction tới 2 instance trong quá trình handover
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch (e) {
      if (e.code === 40060) {
        log.warn('SETUP', interaction.guildId, 'Stale interaction bỏ qua (40060): %s', interaction.id);
        return;
      }
      throw e;
    }

    const { guild } = interaction;
    const [cfg, schedules, members, sessions] = await Promise.all([
      configService.getGuildConfig(guild.id),
      scheduledService.getScheduledSessions(guild.id),
      memberService.getMembers(guild.id),
      getActiveSessions(guild.id),
    ]);
    const view = HomeView.render({ guild, cfg, schedules, members, sessions });
    return interaction.editReply(view);
  }
}

// [FIX] Export trực tiếp class — Sapphire yêu cầu module.exports = Class
module.exports = SetupCommand;
