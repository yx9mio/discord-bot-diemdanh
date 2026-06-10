// src/interaction-handlers/setup/setupStats.js
// [FIX] Đọc ctx: từ footer để reload đúng view khi REFRESH
// [FIX] Đọc uid: từ footer để REFRESH "xem người khác" reload đúng target
// [FIX] renderToi: truyền interaction.user.id làm viewerId → footer encode uid khi cần
'use strict';
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { getMemberStats, getMemberBadges, getTopMembers, getServerStats } = require('../../services/memberService.js');
const { getAttendancesByUser } = require('../../services/attendanceService.js');
const log = require('../../utils/logger.js');
const { StatsView } = require('../../commands/setup/_views/_StatsView.js');
const { CUSTOM_ID } = StatsView;

// CustomId mà HomeView gửi khi bấm nút "Thống kê"
const HOME_STATS_ID = 'setup:stats';

/** Đọc ctx: từ footer của embed đầu tiên trong message */
function _readCtx(interaction) {
  try {
    const footer = interaction.message?.embeds?.[0]?.footer?.text ?? '';
    const m = footer.match(/ctx:(\w+)/);
    return m ? m[1] : 'menu';
  } catch { return 'menu'; }
}

/**
 * [FIX] Đọc uid: từ footer
 * Quan trọng khi admin đang xem stats hoặc lịch sử của người khác.
 * renderToi() sẽ encode uid:${userId} vào footer khi viewerId !== userId.
 */
function _readUid(interaction) {
  try {
    const footer = interaction.message?.embeds?.[0]?.footer?.text ?? '';
    const m = footer.match(/uid:(\d{10,20})/);
    return m ? m[1] : null;
  } catch { return null; }
}

class SetupStatsHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
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

    // ── Mở menu thống kê từ dashboard ─────────────────────────────────
    if (customId === HOME_STATS_ID) {
      await interaction.deferUpdate();
      return interaction.editReply(StatsView.renderStatsMenu());
    }

    // ── Server stats ──────────────────────────────────────────────────
    if (customId === CUSTOM_ID.SERVER) {
      await interaction.deferUpdate();
      try {
        const [stats, top] = await Promise.all([
          getServerStats(guild.id),
          getTopMembers(guild.id, 5),
        ]);
        return interaction.editReply(await StatsView.renderServerStats(stats, top, guild));
      } catch (e) {
        log.error('SETUP_STATS', guild.id, 'getServerStats thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể tải stats server, thử lại sau.' });
      }
    }

    // ── Thống kê cá nhân ──────────────────────────────────────────────
    if (customId === CUSTOM_ID.TOI) {
      await interaction.deferUpdate();
      try {
        const [stats, badges] = await Promise.all([
          getMemberStats(guild.id, interaction.user.id),
          getMemberBadges(guild.id, interaction.user.id),
        ]);
        let member;
        try { member = await guild.members.fetch(interaction.user.id); } catch { member = null; }
        // [FIX] truyền viewerId = interaction.user.id (xem của chính mình → không encode uid)
        return interaction.editReply(StatsView.renderToi(stats, member, guild, badges, interaction.user.id));
      } catch (e) {
        log.error('SETUP_STATS', guild.id, 'getMemberStats thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể tải stats cá nhân, thử lại sau.' });
      }
    }

    // ── Bảng xếp hạng ─────────────────────────────────────────────────
    if (customId === CUSTOM_ID.RANK) {
      await interaction.deferUpdate();
      try {
        const top = await getTopMembers(guild.id, 10);
        return interaction.editReply(await StatsView.renderRank(top, guild));
      } catch (e) {
        log.error('SETUP_STATS', guild.id, 'getTopMembers thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể tải bảng xếp hạng, thử lại sau.' });
      }
    }

    // ── Lịch sử cá nhân ───────────────────────────────────────────────
    if (customId === CUSTOM_ID.LICHSU) {
      await interaction.deferUpdate();
      try {
        let records = await getAttendancesByUser(guild.id, interaction.user.id);
        if (!Array.isArray(records)) records = [];
        return interaction.editReply(await StatsView.renderLichSu(records, interaction.user.id, guild, 0));
      } catch (e) {
        log.error('SETUP_STATS', guild.id, 'getLichSu thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể tải lịch sử, thử lại sau.' });
      }
    }

    // ── Xem người khác → modal ────────────────────────────────────────
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

    // ── REFRESH: reload đúng view hiện tại dựa vào ctx: trong footer ──
    if (customId === CUSTOM_ID.REFRESH) {
      await interaction.deferUpdate();
      const ctx = _readCtx(interaction);

      try {
        if (ctx === 'toi') {
          const targetId = _readUid(interaction) ?? interaction.user.id;
          const [stats, badges] = await Promise.all([
            getMemberStats(guild.id, targetId),
            getMemberBadges(guild.id, targetId),
          ]);
          let member;
          const userId = stats?.user_id ?? targetId;
          try { member = await guild.members.fetch(userId); } catch { member = null; }
          const viewerId = userId !== interaction.user.id ? interaction.user.id : userId;
          return interaction.editReply(StatsView.renderToi(stats, member, guild, badges, viewerId));
        }

        if (ctx === 'rank') {
          const top = await getTopMembers(guild.id, 10);
          return interaction.editReply(await StatsView.renderRank(top, guild));
        }

        if (ctx === 'server') {
          const [stats, top] = await Promise.all([
            getServerStats(guild.id),
            getTopMembers(guild.id, 5),
          ]);
          return interaction.editReply(await StatsView.renderServerStats(stats, top, guild));
        }

        if (ctx === 'lichsu') {
          const targetId = _readUid(interaction) ?? interaction.user.id;
          let records = await getAttendancesByUser(guild.id, targetId);
          if (!Array.isArray(records)) records = [];
          let currentPage = 0;
          try {
            const footer = interaction.message?.embeds?.[0]?.footer?.text ?? '';
            const m = footer.match(/Trang (\d+)\/(\d+)/);
            if (m) currentPage = parseInt(m[1], 10) - 1;
          } catch { /* keep 0 */ }
          return interaction.editReply(await StatsView.renderLichSu(records, targetId, guild, currentPage));
        }

        return interaction.editReply(StatsView.renderStatsMenu());
      } catch (e) {
        log.error('SETUP_STATS_REFRESH', guild.id, 'refresh thất bại ctx=%s: %s', ctx, e.message);
        return interaction.editReply({ content: '❌ Không thể làm mới, thử lại sau.' });
      }
    }
  }
}

module.exports = { SetupStatsHandler };
