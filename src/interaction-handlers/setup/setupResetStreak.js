'use strict';
// interaction-handlers/setup/setupResetStreak.js
// [FIX-PATH] ../../../ → ../../../../
// [FIX-3] parse(): đặt check cụ thể (reset:all, confirm, cancel) TRƯỚC startsWith(RESET_PREFIX)
const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const memberService = require('../../../services/memberService.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { replyErrEdit } = require('../../../utils/embeds.js');
const log = require('../../../utils/logger.js');

const RESET_PREFIX   = 'setup:mem:reset:';
const CONFIRM_PREFIX = 'setup:mem:reset:confirm:';
const CANCEL_PREFIX  = 'setup:mem:reset:cancel:';

class SetupResetStreakHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const { customId } = interaction;
    if (customId === 'setup:mem:reset:all')         return this.some();
    if (customId === 'setup:mem:reset:all:confirm') return this.some();
    if (customId === 'setup:mem:reset:all:cancel')  return this.some();
    if (customId.startsWith(CONFIRM_PREFIX))        return this.some();
    if (customId.startsWith(CANCEL_PREFIX))         return this.some();
    if (
      customId.startsWith(RESET_PREFIX) &&
      customId !== 'setup:mem:reset:all' &&
      !customId.startsWith(CONFIRM_PREFIX) &&
      !customId.startsWith(CANCEL_PREFIX) &&
      !customId.startsWith('setup:mem:reset:all')
    ) return this.some();
    return this.none();
  }

  async run(interaction) {
    const { guild, customId } = interaction;

    if (customId === 'setup:mem:reset:all') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { ok } = await requireAdmin(interaction, { context: 'reset tất cả streak', deferred: true });
      if (!ok) return;
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('setup:mem:reset:all:confirm').setLabel('Xác nhận').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('setup:mem:reset:all:cancel').setLabel('Hủy').setStyle(ButtonStyle.Secondary),
      );
      return interaction.editReply({ content: '⚠️ Bạn có chắc muốn reset streak **tất cả** thành viên?', components: [row] });
    }

    if (customId === 'setup:mem:reset:all:confirm') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { ok } = await requireAdmin(interaction, { context: 'reset tất cả streak', deferred: true });
      if (!ok) return;
      try {
        const members = await memberService.getMembers(guild.id);
        await memberService.batchResetStreak(guild.id, members.map(m => m.user_id));
        log.info('SETUP_RESET_STREAK_ALL', guild.id, 'Reset streak tất cả %d thành viên', members.length);
        return interaction.editReply({ content: `✅ Đã reset streak của **${members.length}** thành viên về 0.`, components: [] });
      } catch (e) {
        log.error('SETUP_RESET_STREAK_ALL', guild.id, 'Reset all streak thất bại: %s', e.message);
        return interaction.editReply(replyErrEdit('Không thể reset streak, thử lại sau.'));
      }
    }

    if (customId === 'setup:mem:reset:all:cancel') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      return interaction.editReply({ content: '↩️ Đã hủy.', components: [] });
    }

    if (customId.startsWith(CONFIRM_PREFIX)) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { ok } = await requireAdmin(interaction, { context: 'reset streak', deferred: true });
      if (!ok) return;
      const userId = customId.slice(CONFIRM_PREFIX.length);
      try {
        await memberService.resetStreak(guild.id, userId);
        log.info('SETUP_RESET_STREAK', guild.id, 'Reset streak userId=%s', userId);
        return interaction.editReply({ content: `✅ Đã reset streak của <@${userId}>.`, components: [] });
      } catch (e) {
        log.error('SETUP_RESET_STREAK', guild.id, 'Reset streak thất bại userId=%s: %s', userId, e.message);
        return interaction.editReply(replyErrEdit('Reset thất bại, thử lại sau.'));
      }
    }

    if (customId.startsWith(CANCEL_PREFIX)) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      return interaction.editReply({ content: '↩️ Đã hủy.', components: [] });
    }

    if (customId.startsWith(RESET_PREFIX)) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { ok } = await requireAdmin(interaction, { context: 'reset streak', deferred: true });
      if (!ok) return;
      const userId = customId.slice(RESET_PREFIX.length);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${CONFIRM_PREFIX}${userId}`).setLabel('Xác nhận').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`${CANCEL_PREFIX}${userId}`).setLabel('Hủy').setStyle(ButtonStyle.Secondary),
      );
      return interaction.editReply({ content: `⚠️ Xác nhận reset streak của <@${userId}>?`, components: [row] });
    }
  }
}

module.exports = { SetupResetStreakHandler };
