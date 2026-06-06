'use strict';
const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { getMemberStats, getMemberBadges, getTopMembers, getServerStats } = require('../../services/memberService.js');
const { getAttendancesByUser } = require('../../services/attendanceService.js');
const { requireAdmin } = require('../../utils/permissions.js');
const { StatsView } = require('../../src/commands/setup/_views/_StatsView.js');
const { CUSTOM_ID } = StatsView;

const XEM_MODAL_ID       = 'setup:stats:xem:modal';
const LICHSU_PAGE_NEXT   = 'setup:stats:lichsu:next';
const LICHSU_PAGE_PREV   = 'setup:stats:lichsu:prev';

const HANDLED_IDS = new Set([
  'setup:stats',
  CUSTOM_ID.TOI,
  CUSTOM_ID.RANK,
  CUSTOM_ID.SERVER,
  CUSTOM_ID.XEM,
  CUSTOM_ID.LICHSU,
  CUSTOM_ID.REFRESH,
  LICHSU_PAGE_NEXT,
  LICHSU_PAGE_PREV,
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
    const { customId, guild, user } = interaction;

    // ── Menu chính / Làm mới ──────────────────────────────────────────────────
    if (customId === 'setup:stats' || customId === CUSTOM_ID.REFRESH) {
      await interaction.deferUpdate();
      return interaction.editReply(StatsView.renderStatsMenu());
    }

    // ── Của tôi ───────────────────────────────────────────────────────────────
    if (customId === CUSTOM_ID.TOI) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const [stats, badges] = await Promise.all([
        getMemberStats(guild.id, user.id),
        getMemberBadges(guild.id, user.id),
      ]);
      const member = guild.members.cache.get(user.id)
        ?? await guild.members.fetch(user.id).catch(() => null);
      return interaction.editReply(StatsView.renderToi(stats, member, guild, badges));
    }

    // ── Xếp hạng ─────────────────────────────────────────────────────────────
    if (customId === CUSTOM_ID.RANK) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const rows   = await getTopMembers(guild.id, 10);
      // renderRank là async (cần fetch members)
      const reply  = await StatsView.renderRank(rows, guild, 10);
      return interaction.editReply(reply);
    }

    // ── Thống kê Server ───────────────────────────────────────────────────────
    if (customId === CUSTOM_ID.SERVER) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const stats = await getServerStats(guild.id);
      return interaction.editReply(StatsView.renderServerStats(stats));
    }

    // ── Lịch sử (lần đầu) + phân trang ──────────────────────────────────────
    if (customId === CUSTOM_ID.LICHSU || customId === LICHSU_PAGE_NEXT || customId === LICHSU_PAGE_PREV) {
      const isPageNav = customId === LICHSU_PAGE_NEXT || customId === LICHSU_PAGE_PREV;

      if (isPageNav) {
        await interaction.deferUpdate();
      } else {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      }

      // [FIX] Khi phân trang, đọc targetUserId từ footer embed thay vì hardcode user.id.
      // Admin xem người khác rồi bấm "Trang sau" sẽ vẫn lấy đúng hồ sơ target.
      let targetUserId = user.id;
      let curPage = 0;

      if (isPageNav) {
        const extracted = _extractPageAndUser(interaction);
        curPage      = extracted.page;
        targetUserId = extracted.userId ?? user.id;
      }

      const newPage = Math.max(
        0,
        curPage + (customId === LICHSU_PAGE_NEXT ? 1 : -1),
      );

      const records = await getAttendancesByUser(guild.id, targetUserId, 100);
      return interaction.editReply(StatsView.renderLichSu(records, targetUserId, guild, newPage));
    }

    // ── Xem người khác (mở modal) ─────────────────────────────────────────────
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

// ── Modal: xem stats của người khác ──────────────────────────────────────────
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
    // Chuẩn hoá mention <@123> hoặc <@!123>
    if (rawId.startsWith('<@') && rawId.endsWith('>')) {
      rawId = rawId.slice(2, -1).replace('!', '');
    }

    let member;
    try {
      member = await guild.members.fetch(rawId);
    } catch {
      return interaction.editReply({ content: `❌ Không tìm thấy thành viên với ID: \`${rawId}\`.` });
    }

    const [stats, badges, records] = await Promise.all([
      getMemberStats(guild.id, member.id),
      getMemberBadges(guild.id, member.id),
      getAttendancesByUser(guild.id, member.id, 100),
    ]);

    // Trả về embed Của tôi + nút Lịch sử để admin có thể phân trang
    const toiReply   = StatsView.renderToi(stats, member, guild, badges);
    const lichSuView = StatsView.renderLichSu(records, member.id, guild, 0);

    // Gộp: hiển thị stats trước, kèm nav lịch sử nếu có dữ liệu
    return interaction.editReply({
      embeds:     toiReply.embeds,
      components: lichSuView.components.length ? lichSuView.components : [],
    });
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────
/**
 * Đọc trang hiện tại VÀ userId được encode trong footer embed.
 * Footer format: "... · Trang X/Y · N bản ghi · uid:<userId>"
 *
 * @param {import('discord.js').ButtonInteraction} interaction
 * @returns {{ page: number, userId: string|null }}
 */
function _extractPageAndUser(interaction) {
  try {
    const footer = interaction.message?.embeds?.[0]?.footer?.text ?? '';

    // Page
    const pageMatch = footer.match(/Trang (\d+)\/(\d+)/);
    const page = pageMatch ? Math.max(0, parseInt(pageMatch[1], 10) - 1) : 0;

    // UserId
    const uidMatch = footer.match(/uid:(\d+)/);
    const userId   = uidMatch ? uidMatch[1] : null;

    return { page, userId };
  } catch (_e) {
    return { page: 0, userId: null };
  }
}

module.exports = { SetupStatsHandler, SetupStatsXemModalHandler };
