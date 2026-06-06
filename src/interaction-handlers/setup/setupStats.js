// src/interaction-handlers/setup/setupStats.js
// [FIX-ROOT] Thêm 'setup:stats' (HomeView.CUSTOM_ID.STATS) vào parse() → mở menu thống kê
// [FIX-PATH] services/ và utils/ nằm ở root, cần ../../../../ (không phải ../../../)
'use strict';
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
// [FIX-PATH] src/interaction-handlers/setup/ → lên 4 cấp → root/services/
const { getMemberStats, getMemberBadges, getTopMembers, getServerStats } = require('../../../../services/memberService.js');
const { getAttendancesByUser } = require('../../../../services/attendanceService.js');
// [FIX-PATH] utils/ cũng ở root
const log = require('../../../../utils/logger.js');
const { StatsView } = require('../../commands/setup/_views/_StatsView.js');
const { CUSTOM_ID } = StatsView;

// CustomId mà HomeView gửi khi bấm nút "Thống kê"
const HOME_STATS_ID = 'setup:stats';

class SetupStatsHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    // [FIX-ROOT] Nút từ Dashboard gửi 'setup:stats', cần handle riêng để mở menu
    if (interaction.customId === HOME_STATS_ID) return this.some();

    const handled = new Set([
      CUSTOM_ID.TOI,
      CUSTOM_ID.RANK,
      CUSTOM_ID.LICHSU,
      CUSTOM_ID.XEM,
      CUSTOM_ID.SERVER,
      CUSTOM_ID.REFRESH,
    ]);
    if (handled.has(interaction.customId)) return this.some();
    return this.none();
  }

  async run(interaction) {
    const { guild, customId } = interaction;

    // [FIX-ROOT] Mở menu thống kê từ dashboard
    if (customId === HOME_STATS_ID) {
      await interaction.deferUpdate();
      return interaction.editReply(StatsView.renderStatsMenu());
    }

    if (customId === CUSTOM_ID.SERVER) {
      await interaction.deferUpdate();
      try {
        const [stats, top] = await Promise.all([
          getServerStats(guild.id),
          getTopMembers(guild.id, 5),
        ]);
        return interaction.editReply(StatsView.renderServerStats(stats, top, guild));
      } catch (e) {
        log.error('SETUP_STATS', guild.id, 'getServerStats thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể tải stats server, thử lại sau.' });
      }
    }

    if (customId === CUSTOM_ID.TOI) {
      await interaction.deferUpdate();
      try {
        const stats  = await getMemberStats(guild.id, interaction.user.id);
        const badges = await getMemberBadges(guild.id, interaction.user.id);
        let member;
        try { member = await guild.members.fetch(interaction.user.id); } catch { member = null; }
        return interaction.editReply(StatsView.renderToi(stats, member, guild, badges));
      } catch (e) {
        log.error('SETUP_STATS', guild.id, 'getMemberStats thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể tải stats cá nhân, thử lại sau.' });
      }
    }

    if (customId === CUSTOM_ID.RANK) {
      await interaction.deferUpdate();
      try {
        const top = await getTopMembers(guild.id, 10);
        return interaction.editReply(StatsView.renderRank(top, guild));
      } catch (e) {
        log.error('SETUP_STATS', guild.id, 'getTopMembers thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể tải bảng xếp hạng, thử lại sau.' });
      }
    }

    if (customId === CUSTOM_ID.LICHSU) {
      await interaction.deferUpdate();
      try {
        const records = await getAttendancesByUser(guild.id, interaction.user.id);
        return interaction.editReply(StatsView.renderLichSu(records, interaction.user.id, guild, 0));
      } catch (e) {
        log.error('SETUP_STATS', guild.id, 'getLichSu thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể tải lịch sử, thử lại sau.' });
      }
    }

    if (customId === CUSTOM_ID.XEM) {
      const modal = new ModalBuilder()
        .setCustomId('setup:stats:xem:modal')
        .setTitle('Xem điểm danh thành viên khác')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('user_id')
              .setLabel('User ID hoặc @mention')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMaxLength(100)
              .setPlaceholder('123456789012345678 hoặc @username'),
          ),
        );
      return interaction.showModal(modal);
    }

    if (customId === CUSTOM_ID.REFRESH) {
      await interaction.deferUpdate();
      return interaction.editReply(StatsView.renderStatsMenu());
    }
  }
}

module.exports = { SetupStatsHandler };
