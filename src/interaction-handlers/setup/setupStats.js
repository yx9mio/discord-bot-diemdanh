// src/interaction-handlers/setup/setupStats.js
// Handles: setup:stats + các nút stats (Button) — hiển thị Stats view
'use strict';
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js'); // [FIX-BUG9] Removed unused MessageFlags
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { getMemberStats, getMemberBadges, getTopMembers, getServerStats } = require('../../../services/memberService.js');
const { getAttendancesByUser } = require('../../../services/attendanceService.js');
const log = require('../../../utils/logger.js');
const { StatsView } = require('../../commands/setup/_views/_StatsView.js');
const { CUSTOM_ID } = StatsView;

class SetupStatsHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }
  parse(interaction) {
    if (interaction.customId === CUSTOM_ID.STATS_OPEN ||
        interaction.customId === CUSTOM_ID.STATS_MEMBER ||
        interaction.customId === CUSTOM_ID.STATS_SERVER ||
        interaction.customId === CUSTOM_ID.STATS_TOP ||
        interaction.customId === CUSTOM_ID.STATS_SEARCH)
      return this.some();
    return this.none();
  }
  async run(interaction) {
    const { guild, customId } = interaction;

    if (customId === CUSTOM_ID.STATS_OPEN || customId === CUSTOM_ID.STATS_SERVER) {
      await interaction.deferReply({ ephemeral: true });
      try {
        const stats = await getServerStats(guild.id);
        const top   = await getTopMembers(guild.id, 5);
        return interaction.editReply(StatsView.serverStats(stats, top));
      } catch (e) {
        log.error('SETUP_STATS', guild.id, 'getServerStats thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể tải stats, thử lại sau.' });
      }
    }

    if (customId === CUSTOM_ID.STATS_MEMBER) {
      await interaction.deferReply({ ephemeral: true });
      try {
        const stats    = await getMemberStats(guild.id, interaction.user.id);
        const atts     = await getAttendancesByUser(guild.id, interaction.user.id);
        const badges   = await getMemberBadges(guild.id, interaction.user.id);
        return interaction.editReply(StatsView.memberStats(interaction.user, stats, atts, badges));
      } catch (e) {
        log.error('SETUP_STATS', guild.id, 'getMemberStats thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể tải stats cá nhân, thử lại sau.' });
      }
    }

    if (customId === CUSTOM_ID.STATS_TOP) {
      await interaction.deferReply({ ephemeral: true });
      try {
        const top = await getTopMembers(guild.id, 10);
        return interaction.editReply(StatsView.topMembers(top));
      } catch (e) {
        log.error('SETUP_STATS', guild.id, 'getTopMembers thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể tải bảng xếp hạng, thử lại sau.' });
      }
    }

    if (customId === CUSTOM_ID.STATS_SEARCH) {
      const modal = new ModalBuilder()
        .setCustomId('setup:stats:search:modal')
        .setTitle('Tìm kiếm thành viên')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('user_query')
              .setLabel('Nhập tên hoặc ID thành viên')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        );
      return interaction.showModal(modal);
    }
  }
}

module.exports = { SetupStatsHandler };
