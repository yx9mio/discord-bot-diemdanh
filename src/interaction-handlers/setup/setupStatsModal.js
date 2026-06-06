// src/interaction-handlers/setup/setupStatsModal.js
// Handles: setup:stats:xem:modal (ModalSubmit) — xem thống kê thành viên cụ thể
// [BUG-3] Modal ID giữ nguyên 'setup:stats:xem:modal' (đây là đúng, setupStats.js đã fix để khớp)
// [BUG-A] Fix import path: services ở root, không phải src/services
'use strict';
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
// [BUG-A] Đúng path: services nằm ở root
const { getMemberStats, getMemberBadges } = require('../../../../services/memberService.js');
const log = require('../../../utils/logger.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { StatsView } = require('../../commands/setup/_views/_StatsView.js');

const XEM_MODAL_ID = 'setup:stats:xem:modal';

class SetupStatsXemModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId === XEM_MODAL_ID) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { ok } = await requireAdmin(interaction, { context: 'xem stats thành viên', deferred: true });
    if (!ok) return;

    const { guild } = interaction;
    const rawId = interaction.fields.getTextInputValue('user_id').trim().replace(/[<@!>]/g, '');
    if (!rawId) return interaction.editReply({ content: '❌ User ID không hợp lệ.' });

    let member;
    try { member = await guild.members.fetch(rawId); } catch {
      return interaction.editReply({ content: `❌ Không tìm thấy user \`${rawId}\` trong server.` });
    }

    const [stats, badges] = await Promise.all([
      getMemberStats(guild.id, rawId).catch(() => null),
      getMemberBadges(guild.id, rawId).catch(() => []),
    ]);

    log.info('STATS_XEM', guild.id, 'Xem stats của %s', rawId);
    return interaction.editReply(StatsView.renderToi(stats, member, guild, badges));
  }
}

module.exports = { SetupStatsXemModalHandler };
