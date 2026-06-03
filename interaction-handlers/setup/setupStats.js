'use strict';
const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const db = require('../../db.js');
const log = require('../../utils/logger.js');
const { requireAdmin } = require('../../utils/permissions.js');
const { StatsView } = require('../../src/commands/setup/_StatsView.js');
const { CUSTOM_ID } = StatsView;

const XEM_MODAL_ID = 'setup:stats:xem:modal';
const LICHSU_PAGE_PREFIX = 'setup:stats:lichsu';
const LICHSU_PAGE_NEXT = 'setup:stats:lichsu:next';
const LICHSU_PAGE_PREV = 'setup:stats:lichsu:prev';

class SetupStatsHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === 'setup:stats') return this.some();
    if (id === CUSTOM_ID.TOI || id === CUSTOM_ID.RANK || id === CUSTOM_ID.SERVER) return this.some();
    if (id === CUSTOM_ID.XEM) return this.some();
    if (id === CUSTOM_ID.LICHSU || id === LICHSU_PAGE_NEXT || id === LICHSU_PAGE_PREV) return this.some();
    return this.none();
  }

  async run(interaction) {
    const { customId, guild, user } = interaction;

    if (customId === 'setup:stats') {
      await interaction.deferUpdate();
      return interaction.editReply(StatsView.renderStatsMenu());
    }

    if (customId === CUSTOM_ID.TOI) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const [stats, badges] = await Promise.all([
        db.getMemberStats(guild.id, user.id),
        db.getMemberBadges(guild.id, user.id),
      ]);
      const member = guild.members.cache.get(user.id) ?? await guild.members.fetch(user.id).catch(() => null);
      return interaction.editReply(StatsView.renderToi(stats, member, guild, badges));
    }

    if (customId === CUSTOM_ID.RANK) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const rows = await db.getTopMembers(guild.id, 10);
      return interaction.editReply(StatsView.renderRank(rows, guild, 10));
    }

    if (customId === CUSTOM_ID.LICHSU || customId === LICHSU_PAGE_NEXT || customId === LICHSU_PAGE_PREV) {
      const isPageNav = customId === LICHSU_PAGE_NEXT || customId === LICHSU_PAGE_PREV;
      if (isPageNav) {
        await interaction.deferUpdate();
      } else {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      }

      const curPage = isPageNav ? _extractPageFromEmbed(interaction) : 0;
      const newPage = Math.max(0, curPage + (customId === LICHSU_PAGE_NEXT ? 1 : -1));

      const records = await db.getAttendancesByUser(guild.id, user.id, 100);
      const view = StatsView.renderLichSu(records, user.id, guild, newPage);

      return interaction.editReply(view);
    }

    if (customId === CUSTOM_ID.XEM) {
      const modal = new ModalBuilder()
        .setCustomId(XEM_MODAL_ID)
        .setTitle('Xem điểm danh người khác')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('target_user_id')
              .setLabel('User ID hoặc @mention')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('VD: 123456789012345678 hoặc @user')
              .setRequired(true),
          ),
        );
      return interaction.showModal(modal);
    }
  }
}

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
    const { ok } = await requireAdmin(interaction, { context: 'xem điểm danh người khác', deferred: true });
    if (!ok) return;
    const { guild } = interaction;
    let rawId = interaction.fields.getTextInputValue('target_user_id').trim();
    if (rawId.startsWith('<@') && rawId.endsWith('>')) {
      rawId = rawId.slice(2, -1).replace('!', '');
    }

    let member;
    try {
      member = await guild.members.fetch(rawId);
    } catch {
      return interaction.editReply({ content: `❌ Không tìm thấy thành viên với ID: ${rawId}.` });
    }

    const [stats, badges] = await Promise.all([
      db.getMemberStats(guild.id, member.id),
      db.getMemberBadges(guild.id, member.id),
    ]);

    return interaction.editReply(StatsView.renderToi(stats, member, guild, badges));
  }
}

function _extractPageFromEmbed(interaction) {
  try {
    const embed = interaction.message?.embeds?.[0];
    const footer = embed?.footer?.text ?? '';
    const match = footer.match(/Trang (\d+)\/(\d+)/);
    if (match) return Math.max(0, parseInt(match[1], 10) - 1);
  } catch (_e) { /* fallthrough */ }
  return 0;
}

module.exports = { SetupStatsHandler, SetupStatsXemModalHandler };
