// src/interaction-handlers/setup/setupStats.js
// [FIX] Đọc ctx: từ footer để reload đúng view khi REFRESH
// [FIX] Đọc uid: từ footer để REFRESH "xem người khác" reload đúng target
// [FIX] renderToi: truyền interaction.user.id làm viewerId → footer encode uid khi cần
'use strict';
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { DateTime } = require('luxon');
const { getMemberStats, getMemberBadges, getTopMembers, getDistinctPhongBan, getServerStats } = require('../../../services/memberService.js');
const { getAttendancesByUser } = require('../../../services/attendanceService.js');
const { getGuildConfig } = require('../../../services/configService.js');
const log = require('../../../utils/logger.js');
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

function _computeDateRange(period) {
  if (period === 'all') return { startDate: null, endDate: null };
  const now = DateTime.now();
  if (period === 'week') return { startDate: now.startOf('week').toISO(), endDate: null };
  if (period === 'month') return { startDate: now.startOf('month').toISO(), endDate: null };
  return { startDate: null, endDate: null };
}

async function _renderServerStats(interaction, period = 'all') {
  const { startDate, endDate } = _computeDateRange(period);
  const [stats, top] = await Promise.all([
    getServerStats(interaction.guild.id, startDate, endDate),
    getTopMembers(interaction.guild.id, 5),
  ]);

  // Fetch previous period for trend
  let prevStats = null;
  if (period !== 'all') {
    const now = DateTime.now();
    const prevStart = period === 'week'
      ? now.minus({ weeks: 1 }).startOf('week').toISO()
      : now.minus({ months: 1 }).startOf('month').toISO();
    const prevEnd = period === 'week'
      ? now.startOf('week').toISO()
      : now.startOf('month').toISO();
    prevStats = await getServerStats(interaction.guild.id, prevStart, prevEnd).catch(() => null);
  }

  return interaction.editReply(await StatsView.renderServerStats(stats, top, interaction.guild, period, prevStats));
}

function _readPeriod(interaction) {
  try {
    const footer = interaction.message?.embeds?.[0]?.footer?.text ?? '';
    const m = footer.match(/period:(\w+)/);
    return m ? m[1] : 'all';
  } catch { return 'all'; }
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
      CUSTOM_ID.RANK_ALL,
      CUSTOM_ID.SERVER_PERIOD_WEEK,
      CUSTOM_ID.SERVER_PERIOD_MONTH,
      CUSTOM_ID.SERVER_PERIOD_ALL,
    ]);
    if (handled.has(interaction.customId)) return this.some();
    if (interaction.customId.startsWith(CUSTOM_ID.RANK_PHAI_PREFIX)) return this.some();
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
        return _renderServerStats(interaction, 'all');
      } catch (e) {
        log.error('SETUP_STATS', guild.id, 'getServerStats thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể tải stats server, thử lại sau.', embeds: [], files: [] });
      }
    }

    // ── Server stats — period filter ──────────────────────────────────
    if ([CUSTOM_ID.SERVER_PERIOD_WEEK, CUSTOM_ID.SERVER_PERIOD_MONTH, CUSTOM_ID.SERVER_PERIOD_ALL].includes(customId)) {
      await interaction.deferUpdate();
      const period = customId === CUSTOM_ID.SERVER_PERIOD_WEEK ? 'week'
                   : customId === CUSTOM_ID.SERVER_PERIOD_MONTH ? 'month'
                   : 'all';
      try {
        return _renderServerStats(interaction, period);
      } catch (e) {
        log.error('SETUP_STATS', guild.id, 'server period thất bại period=%s: %s', period, e.message);
        return interaction.editReply({ content: '❌ Không thể lọc server stats, thử lại sau.', embeds: [], files: [] });
      }
    }

    // ── Rank filter — phái ────────────────────────────────────────────
    if (customId === CUSTOM_ID.RANK_ALL || customId.startsWith(CUSTOM_ID.RANK_PHAI_PREFIX)) {
      await interaction.deferUpdate();
      const filterPhaiRoleId = customId === CUSTOM_ID.RANK_ALL ? '' : customId.slice(CUSTOM_ID.RANK_PHAI_PREFIX.length);
      try {
        const [top, pbList, cfg] = await Promise.all([
          filterPhaiRoleId
            ? getTopMembers(guild.id, 10, null, filterPhaiRoleId)
            : getTopMembers(guild.id, 10),
          getDistinctPhongBan(guild.id),
          getGuildConfig(guild.id),
        ]);
        return interaction.editReply(await StatsView.renderRank(top, guild, 10, pbList, '', cfg, filterPhaiRoleId));
      } catch (e) {
        log.error('SETUP_STATS', guild.id, 'rank phai filter thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể lọc xếp hạng, thử lại sau.', embeds: [], files: [] });
      }
    }

    // ── Thống kê cá nhân ──────────────────────────────────────────────
    if (customId === CUSTOM_ID.TOI) {
      await interaction.deferUpdate();
      try {
        const [stats, badges, cfg, records] = await Promise.all([
          getMemberStats(guild.id, interaction.user.id),
          getMemberBadges(guild.id, interaction.user.id),
          getGuildConfig(guild.id),
          getAttendancesByUser(guild.id, interaction.user.id).then(r => Array.isArray(r) ? r.slice(0, 10) : []),
        ]);
        let member;
        try { member = await guild.members.fetch(interaction.user.id); } catch { member = null; }
        // [FIX] truyền viewerId = interaction.user.id (xem của chính mình → không encode uid)
        return interaction.editReply(StatsView.renderToi(stats, member, guild, badges, interaction.user.id, cfg, records));
      } catch (e) {
        log.error('SETUP_STATS', guild.id, 'getMemberStats thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể tải stats cá nhân, thử lại sau.', embeds: [], files: [] });
      }
    }

    // ── Bảng xếp hạng ─────────────────────────────────────────────────
    if (customId === CUSTOM_ID.RANK) {
      await interaction.deferUpdate();
      try {
        const [top, pbList, cfg] = await Promise.all([
          getTopMembers(guild.id, 10),
          getDistinctPhongBan(guild.id),
          getGuildConfig(guild.id),
        ]);
        return interaction.editReply(await StatsView.renderRank(top, guild, 10, pbList, '', cfg, ''));
      } catch (e) {
        log.error('SETUP_STATS', guild.id, 'getTopMembers thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể tải bảng xếp hạng, thử lại sau.', embeds: [], files: [] });
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
        return interaction.editReply({ content: '❌ Không thể tải lịch sử, thử lại sau.', embeds: [], files: [] });
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
          const [stats, badges, cfg, records] = await Promise.all([
            getMemberStats(guild.id, targetId),
            getMemberBadges(guild.id, targetId),
            getGuildConfig(guild.id),
            getAttendancesByUser(guild.id, targetId).then(r => Array.isArray(r) ? r.slice(0, 10) : []),
          ]);
          let member;
          const userId = stats?.user_id ?? targetId;
          try { member = await guild.members.fetch(userId); } catch { member = null; }
          const viewerId = userId !== interaction.user.id ? interaction.user.id : userId;
          return interaction.editReply(StatsView.renderToi(stats, member, guild, badges, viewerId, cfg, records));
        }

        if (ctx === 'rank') {
          const footer = interaction.message?.embeds?.[0]?.footer?.text ?? '';
          const pbMatch = footer.match(/pb:(.+)/);
          const selectedPb = pbMatch ? pbMatch[1].trim() : '';
          const phaiMatch = footer.match(/phai:(\d+)/);
          const filterPhaiRoleId = phaiMatch ? phaiMatch[1] : '';
          const [top, pbList, cfg] = await Promise.all([
            filterPhaiRoleId
              ? getTopMembers(guild.id, 10, selectedPb || null, filterPhaiRoleId)
              : getTopMembers(guild.id, 10, selectedPb || null),
            getDistinctPhongBan(guild.id),
            getGuildConfig(guild.id),
          ]);
          return interaction.editReply(await StatsView.renderRank(top, guild, 10, pbList, selectedPb, cfg, filterPhaiRoleId));
        }

        if (ctx === 'server') {
          const period = _readPeriod(interaction);
          return _renderServerStats(interaction, period);
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
        return interaction.editReply({ content: '❌ Không thể làm mới, thử lại sau.', embeds: [], files: [] });
      }
    }
  }
}

module.exports = { SetupStatsHandler };
