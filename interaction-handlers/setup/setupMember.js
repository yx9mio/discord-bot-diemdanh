// interaction-handlers/setup/setupMember.js
// Xử lý: pagination, refresh, select-action menu, search, clear search
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  MessageFlags,
} = require('discord.js');
const memberService = require('../../services/memberService.js');
const log = require('../../utils/logger.js');
const { requireAdmin } = require('../../utils/permissions.js');
const { MemberView } = require('../../src/commands/setup/_views/_MemberView.js');
const { CUSTOM_ID } = MemberView;

const DEL_CONFIRM_PREFIX = 'setup:mem:del:confirm:';
const DEL_CANCEL_PREFIX  = 'setup:mem:del:cancel:';
const SEARCH_MODAL_ID    = 'setup:mem:search:modal';

class SetupMemberHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === 'setup:mem') return this.some();
    if (id === CUSTOM_ID.PAGE_NEXT || id === CUSTOM_ID.PAGE_PREV) return this.some();
    if (id === CUSTOM_ID.REFRESH) return this.some();
    if (id === CUSTOM_ID.SEARCH) return this.some();
    if (id === CUSTOM_ID.SEARCH_CLEAR) return this.some();
    if (id?.startsWith(CUSTOM_ID.DEL_PREFIX)) return this.some();
    if (id?.startsWith(DEL_CONFIRM_PREFIX)) return this.some();
    if (id?.startsWith(DEL_CANCEL_PREFIX)) return this.some();
    return this.none();
  }

  async run(interaction) {
    const { customId, guild } = interaction;

    // ── Mở trang member (từ setup home) ────────────────────────────────────
    if (customId === 'setup:mem') {
      await interaction.deferUpdate();
      const members = await memberService.getMembers(guild.id);
      return interaction.editReply(MemberView.render({ members, page: 0, guild }));
    }

    // ── Refresh ─────────────────────────────────────────────────────────────
    if (customId === CUSTOM_ID.REFRESH) {
      const { page, query } = _extractState(interaction);
      return MemberView.handleRefresh(interaction, page, query);
    }

    // ── Search: mở modal ────────────────────────────────────────────────────
    if (customId === CUSTOM_ID.SEARCH) {
      const modal = new ModalBuilder()
        .setCustomId(SEARCH_MODAL_ID)
        .setTitle('Tìm kiếm thành viên')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('query')
              .setLabel('Nhập tên, phòng ban hoặc User ID')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('VD: Nguyễn Văn A hoặc 123456789')
              .setMaxLength(50)
              .setRequired(true),
          ),
        );
      return interaction.showModal(modal);
    }

    // ── Xóa tìm kiếm ────────────────────────────────────────────────────────
    if (customId === CUSTOM_ID.SEARCH_CLEAR) {
      await interaction.deferUpdate();
      const members = await memberService.getMembers(guild.id);
      return interaction.editReply(MemberView.render({ members, page: 0, guild, query: '' }));
    }

    // ── Pagination ──────────────────────────────────────────────────────────
    if (customId === CUSTOM_ID.PAGE_NEXT || customId === CUSTOM_ID.PAGE_PREV) {
      await interaction.deferUpdate();
      const { page, query } = _extractState(interaction);
      const members = await memberService.getMembers(guild.id);
      const filtered = query
        ? members.filter(m =>
            (m.username ?? '').toLowerCase().includes(query.toLowerCase()) ||
            m.user_id.includes(query) ||
            (m.phong_ban ?? '').toLowerCase().includes(query.toLowerCase())
          )
        : members;
      const totalPages = Math.max(1, Math.ceil(filtered.length / MemberView.PAGE_SIZE));
      const newPage = customId === CUSTOM_ID.PAGE_NEXT
        ? Math.min(page + 1, totalPages - 1)
        : Math.max(0, page - 1);
      return interaction.editReply(MemberView.render({ members, page: newPage, guild, query }));
    }

    // ── Xóa thành viên: bước 1 confirm ─────────────────────────────────────
    if (
      customId.startsWith(CUSTOM_ID.DEL_PREFIX) &&
      !customId.startsWith(DEL_CONFIRM_PREFIX) &&
      !customId.startsWith(DEL_CANCEL_PREFIX)
    ) {
      const userId = customId.slice(CUSTOM_ID.DEL_PREFIX.length);
      return interaction.reply({
        content: `⚠️ Xác nhận xóa <@${userId}> khỏi danh sách quản lý?\n> Streak và lịch sử điểm danh **sẽ giữ nguyên**.`,
        flags: MessageFlags.Ephemeral,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`${DEL_CONFIRM_PREFIX}${userId}`)
              .setLabel('✅ Xác nhận xóa')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId(`${DEL_CANCEL_PREFIX}${userId}`)
              .setLabel('↩️ Hủy')
              .setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
    }

    // ── Xóa thành viên: bước 2 hủy ─────────────────────────────────────────
    if (customId.startsWith(DEL_CANCEL_PREFIX)) {
      await interaction.deferUpdate();
      return interaction.editReply({ content: '↩️ Đã hủy.', components: [] });
    }

    // ── Xóa thành viên: bước 2 xác nhận ────────────────────────────────────
    if (customId.startsWith(DEL_CONFIRM_PREFIX)) {
      await interaction.deferUpdate();
      const userId = customId.slice(DEL_CONFIRM_PREFIX.length);
      try {
        await memberService.deleteMember(guild.id, userId);
        log.info('SETUP_MEM', guild.id, 'Xóa thành viên %s', userId);
      } catch (e) {
        log.error('SETUP_MEM', guild.id, 'deleteMember thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể xóa thành viên, thử lại sau.', components: [] });
      }
      await interaction.editReply({ content: `✅ Đã xóa <@${userId}> khỏi danh sách.`, components: [] });
      try {
        const { page, query } = _extractState(interaction);
        const members = await memberService.getMembers(guild.id);
        await interaction.message?.edit(MemberView.render({ members, page, guild, query })).catch(() => null);
      } catch (_e) { /* fallthrough */ }
    }
  }
}

// ── Modal handler: Search ───────────────────────────────────────────────────
class SetupMemberSearchModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId === SEARCH_MODAL_ID) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferUpdate();
    const query = interaction.fields.getTextInputValue('query').trim();
    const members = await memberService.getMembers(interaction.guild.id);
    return interaction.editReply(
      MemberView.render({ members, page: 0, guild: interaction.guild, query }),
    );
  }
}

// ── Select menu: chọn thành viên → hiện action buttons ──────────────────────
class SetupMemberSelectHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.SelectMenu });
  }

  parse(interaction) {
    if (interaction.customId === CUSTOM_ID.SELECT_ACTION) return this.some();
    return this.none();
  }

  async run(interaction) {
    const userId = interaction.values[0];
    return interaction.reply({
      content: `👤 Thao tác với <@${userId}>:`,
      flags: MessageFlags.Ephemeral,
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`${CUSTOM_ID.EDIT_PREFIX}${userId}`)
            .setLabel('✎ Sửa thông tin')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`${CUSTOM_ID.RESET_PREFIX}${userId}`)
            .setLabel('🔄 Reset streak')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`${CUSTOM_ID.DEL_PREFIX}${userId}`)
            .setLabel('✕ Xóa khỏi danh sách')
            .setStyle(ButtonStyle.Danger),
        ),
      ],
    });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function _extractState(interaction) {
  try {
    const embed = interaction.message?.embeds?.[0];
    const footer = embed?.footer?.text ?? '';
    const pageMatch = footer.match(/Trang (\d+)\/(\d+)/);
    const page = pageMatch ? Math.max(0, parseInt(pageMatch[1], 10) - 1) : 0;
    // Query được lưu trong title: "Thành viên — ServerName · 🔍 "query""
    const title = embed?.title ?? '';
    const queryMatch = title.match(/🔍 "(.+?)"$/);
    const query = queryMatch ? queryMatch[1] : '';
    return { page, query };
  } catch (_e) { return { page: 0, query: '' }; }
}

module.exports = { SetupMemberHandler, SetupMemberSearchModalHandler, SetupMemberSelectHandler };
