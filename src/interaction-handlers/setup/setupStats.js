// src/interaction-handlers/setup/setupStats.js
// Handles: setup:stats + các nút stats (Button) — hiển thị Stats view
'use strict';
const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { getMemberStats, getMemberBadges, getTopMembers, getServerStats } = require('../../../services/memberService.js');
const { getAttendancesByUser } = require('../../../services/attendanceService.js');
const log = require('../../../utils/logger.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { StatsView } = require('../../commands/setup/_views/_StatsView.js');
const { CUSTOM_ID } = StatsView;

const XEM_MODAL_ID     = 'setup:stats:xem:modal';
const LICHSU_PAGE_NEXT = 'setup:stats:lichsu:next';
const LICHSU_PAGE_PREV = 'setup:stats:lichsu:prev';

const HANDLED_IDS = new Set([
  'setup:stats', CUSTOM_ID.TOI, CUSTOM_ID.RANK, CUSTOM_ID.SERVER,
  CUSTOM_ID.XEM, CUSTOM_ID.LICHSU, CUSTOM_ID.REFRESH,
  LICHSU_PAGE_NEXT, LICHSU_PAGE_PREV,
]);

class SetupStatsHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }
  parse(interaction) {
    if (HANDLED_IDS.has(interaction.customId)) return this.some();
    return this.none();
  }
  async run(interaction) {
    await interaction.deferUpdate();
    const { guild, user } = interaction;
    const cid = interaction.customId;

    if (cid === CUSTOM_ID.XEM) {
      const modal = new ModalBuilder().setCustomId(XEM_MODAL_ID).setTitle('Xem thống kê thành viên')
        .addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('user_id').setLabel('User ID').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('VD: 123456789012345678'),
        ));
      return interaction.followUp({ embeds: [], components: [] }).then(() => interaction.showModal(modal)).catch(() => interaction.showModal(modal));
    }

    if (cid === 'setup:stats' || cid === CUSTOM_ID.TOI || cid === CUSTOM_ID.REFRESH) {
      const [stats, badges] = await Promise.all([
        getMemberStats(guild.id, user.id).catch(() => null),
        getMemberBadges(guild.id, user.id).catch(() => []),
      ]);
      // renderToi(stats, member, guild, badges)
      const member = await guild.members.fetch(user.id).catch(() => null);
      return interaction.editReply(StatsView.renderToi(stats, member, guild, badges));
    }

    if (cid === CUSTOM_ID.RANK) {
      const top = await getTopMembers(guild.id, 10).catch(() => []);
      // renderRank(rows, guild, topN)
      return interaction.editReply(StatsView.renderRank(top, guild, 10));
    }

    if (cid === CUSTOM_ID.SERVER) {
      const serverStats = await getServerStats(guild.id).catch(() => null);
      // renderServerStats(stats)
      return interaction.editReply(StatsView.renderServerStats(serverStats));
    }

    if (cid === CUSTOM_ID.LICHSU || cid === LICHSU_PAGE_NEXT || cid === LICHSU_PAGE_PREV) {
      const page = cid === LICHSU_PAGE_NEXT ? 1 : 0;
      const history = await getAttendancesByUser(guild.id, user.id, { page: page + 1, limit: 10 }).catch(() => []);
      // renderLichSu(records, userId, guild, page)
      return interaction.editReply(StatsView.renderLichSu(history, user.id, guild, page));
    }
  }
}

module.exports = { SetupStatsHandler };
