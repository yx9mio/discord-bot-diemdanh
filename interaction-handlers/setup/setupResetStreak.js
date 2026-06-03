'use strict';
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const db = require('../../db.js');
const log = require('../../utils/logger.js');
const { requireAdmin } = require('../../utils/permissions.js');

const RESET_PREFIX = 'setup:mem:reset:';
const CONFIRM_PREFIX = 'setup:mem:reset:confirm:';
const CANCEL_PREFIX = 'setup:mem:reset:cancel:';

class SetupResetStreakHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id?.startsWith(RESET_PREFIX)) return this.some();
    return this.none();
  }

  async run(interaction) {
    const { customId, guild } = interaction;

    // ===== Exact-match branches first (tránh prefix collision) =====

    // Reset tất cả — prompt
    if (customId === 'setup:mem:reset:all') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { ok } = await requireAdmin(interaction, { context: 'reset tất cả streak', deferred: true });
      if (!ok) return;

      return interaction.editReply({
        content: '⚠️ Bạn có chắc muốn reset **streak của tất cả thành viên** về 0? Hành động này không thể hoàn tác.',
        components: [
          new (require('discord.js').ActionRowBuilder)().addComponents(
            new (require('discord.js').ButtonBuilder)()
              .setCustomId('setup:mem:reset:all:confirm')
              .setLabel('✅ Xác nhận')
              .setStyle(require('discord.js').ButtonStyle.Danger),
            new (require('discord.js').ButtonBuilder)()
              .setCustomId('setup:mem:reset:all:cancel')
              .setLabel('↩️ Hủy')
              .setStyle(require('discord.js').ButtonStyle.Secondary),
          ),
        ],
      });
    }

    // Xác nhận reset tất cả
    if (customId === 'setup:mem:reset:all:confirm') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { ok } = await requireAdmin(interaction, { context: 'reset tất cả streak', deferred: true });
      if (!ok) return;

      try {
        const members = await db.getMembers(guild.id);
        for (const m of members) {
          await db.resetStreak(guild.id, m.user_id).catch(() => null);
        }
        log.info('SETUP_RESET_STREAK_ALL', guild.id, 'Reset streak tất cả %d thành viên', members.length);
        return interaction.editReply({ content: `✅ Đã reset streak của **${members.length}** thành viên về 0.` });
      } catch (e) {
        log.error('SETUP_RESET_STREAK_ALL', guild.id, 'Reset all streak thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể reset streak, thử lại sau.' });
      }
    }

    // Hủy reset tất cả
    if (customId === 'setup:mem:reset:all:cancel') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      return interaction.editReply({ content: '↩️ Đã hủy.' });
    }

    // ===== Prefix-based branches =====

    // Reset 1 thành viên — prompt
    if (customId.startsWith(RESET_PREFIX) && !customId.startsWith(CONFIRM_PREFIX) && !customId.startsWith(CANCEL_PREFIX)) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { ok } = await requireAdmin(interaction, { context: 'reset streak', deferred: true });
      if (!ok) return;

      const userId = customId.slice(RESET_PREFIX.length);
      if (!userId || userId.includes(':')) {
        return interaction.editReply({ content: '❌ ID không hợp lệ.' });
      }
      return interaction.editReply({
        content: `⚠️ Bạn có chắc muốn reset streak của <@${userId}> về 0?`,
        components: [
          new (require('discord.js').ActionRowBuilder)().addComponents(
            new (require('discord.js').ButtonBuilder)()
              .setCustomId(CONFIRM_PREFIX + userId)
              .setLabel('✅ Xác nhận')
              .setStyle(require('discord.js').ButtonStyle.Danger),
            new (require('discord.js').ButtonBuilder)()
              .setCustomId(CANCEL_PREFIX + userId)
              .setLabel('↩️ Hủy')
              .setStyle(require('discord.js').ButtonStyle.Secondary),
          ),
        ],
      });
    }

    // Xác nhận reset 1 người
    if (customId.startsWith(CONFIRM_PREFIX)) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { ok } = await requireAdmin(interaction, { context: 'reset streak', deferred: true });
      if (!ok) return;

      const userId = customId.slice(CONFIRM_PREFIX.length);
      try {
        await db.resetStreak(guild.id, userId);
        log.info('SETUP_RESET_STREAK', guild.id, 'Reset streak %s', userId);
        return interaction.editReply({ content: `✅ Đã reset streak của <@${userId}> về 0.` });
      } catch (e) {
        log.error('SETUP_RESET_STREAK', guild.id, 'Reset streak thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể reset streak, thử lại sau.' });
      }
    }

    // Hủy reset 1 người
    if (customId.startsWith(CANCEL_PREFIX)) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      return interaction.editReply({ content: '↩️ Đã hủy.' });
    }
  }
}

module.exports = { SetupResetStreakHandler };
