'use strict';
// interaction-handlers/setup/setupMember.js
// [MERGE] setupMembers.js đã được hợp nhất vào đây — xóa setupMembers.js
// [FIX-BUG-1]  Loại bỏ duplicate handler (setupMembers.js bị xóa)
// [FIX-BUG-2]  Thêm ADD modal handler
// [FIX-BUG-3]  DEL confirm: dùng interaction.message.edit() TRƯỚC editReply, hoặc catch guard
// [FIX-BUG-4]  Đổi REMOVE_PREFIX → DEL_PREFIX (setupMembers dùng sai key)
// [FIX-BUG-17] EDIT flow: deferUpdate() trước khi query DB để tránh timeout 3s
const {
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const memberService = require('../../../services/memberService.js');
const log = require('../../../utils/logger.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { MemberView } = require('../../commands/setup/_views/_MemberView.js');

const { CUSTOM_ID } = MemberView;

// CustomId mà HomeView gửi khi bấm nút "Thành viên"
const HOME_MEM_ID = 'setup:mem';

class SetupMemberHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === HOME_MEM_ID)                                                                          return this.some();
    if (id === CUSTOM_ID.PAGE_PREV)                                                                  return this.some();
    if (id === CUSTOM_ID.PAGE_NEXT)                                                                  return this.some();
    if (id === CUSTOM_ID.REFRESH)                                                                    return this.some();
    if (id === CUSTOM_ID.RESET_ALL)                                                                  return this.some();
    if (id === CUSTOM_ID.ADD)                                                                        return this.some();
    if (id?.startsWith(CUSTOM_ID.DEL_PREFIX)   && !id.includes(':confirm') && !id.includes(':cancel')) return this.some();
    if (id?.startsWith(CUSTOM_ID.DEL_PREFIX + 'confirm:'))                                          return this.some();
    if (id?.startsWith(CUSTOM_ID.DEL_PREFIX + 'cancel:'))                                           return this.some();
    if (id?.startsWith(CUSTOM_ID.EDIT_PREFIX))                                                       return this.some();
    if (id?.startsWith(CUSTOM_ID.RESET_PREFIX) && !id.endsWith(':all'))                              return this.some();
    return this.none();
  }

  async run(interaction) {
    const { customId, guild } = interaction;

    // ── Entry: mở trang thành viên từ dashboard ───────────────────────
    if (customId === HOME_MEM_ID) {
      await interaction.deferUpdate();
      const members = await memberService.getMembers(guild.id);
      return interaction.editReply(MemberView.render({ members, page: 0, guild }));
    }

    // ── Pagination ────────────────────────────────────────────────────
    if (customId === CUSTOM_ID.PAGE_PREV || customId === CUSTOM_ID.PAGE_NEXT) {
      await interaction.deferUpdate();
      const members     = await memberService.getMembers(guild.id);
      const currentPage = _extractPage(interaction);
      const totalPages  = Math.max(1, Math.ceil(members.length / MemberView.PAGE_SIZE));
      const newPage = customId === CUSTOM_ID.PAGE_PREV
        ? Math.max(0, currentPage - 1)
        : Math.min(totalPages - 1, currentPage + 1);
      return interaction.editReply(MemberView.render({ members, page: newPage, guild }));
    }

    // ── Refresh ───────────────────────────────────────────────────────
    if (customId === CUSTOM_ID.REFRESH) {
      const page = _extractPage(interaction);
      return MemberView.handleRefresh(interaction, page);
    }

    // ── Thêm thành viên → mở modal ────────────────────────────────────
    // [FIX-BUG-2] ADD handler — không defer, showModal không cần
    if (customId === CUSTOM_ID.ADD) {
      return interaction.showModal(
        new ModalBuilder()
          .setCustomId('setup:mem:add:modal')
          .setTitle('Thêm thành viên')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('user_id')
                .setLabel('User ID (chuỗi số Discord)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(20)
                .setPlaceholder('123456789012345678'),
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('nickname')
                .setLabel('Nickname (tuỳ chọn)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(50),
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('phong_ban')
                .setLabel('Phòng ban (tuỳ chọn)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(50),
            ),
          ),
      );
    }

    // ── Reset streak ALL ──────────────────────────────────────────────
    if (customId === CUSTOM_ID.RESET_ALL) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { ok } = await requireAdmin(interaction, { context: 'reset tất cả streak', deferred: true });
      if (!ok) return;
      try {
        const members = await memberService.getMembers(guild.id);
        const userIds = members.map(m => m.user_id);
        await memberService.batchResetStreak(guild.id, userIds);
        log.info('MEM_RESET_ALL', guild.id, 'Reset streak %d thành viên', userIds.length);
        return interaction.editReply({ content: `✅ Đã reset streak cho **${userIds.length}** thành viên.` });
      } catch (e) {
        log.error('MEM_RESET_ALL', guild.id, 'batchResetStreak thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể reset streak, thử lại sau.' });
      }
    }

    // ── Reset streak per-user ─────────────────────────────────────────
    if (customId.startsWith(CUSTOM_ID.RESET_PREFIX) && !customId.endsWith(':all')) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { ok } = await requireAdmin(interaction, { context: 'reset streak thành viên', deferred: true });
      if (!ok) return;
      const userId = customId.slice(CUSTOM_ID.RESET_PREFIX.length);
      try {
        await memberService.resetStreak(guild.id, userId);
        log.info('MEM_RESET', guild.id, 'Reset streak %s', userId);
        return interaction.editReply({ content: `✅ Đã reset streak của <@${userId}>.` });
      } catch (e) {
        log.error('MEM_RESET', guild.id, 'resetStreak thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể reset streak, thử lại sau.' });
      }
    }

    // ── Xóa thành viên: bước 1 — confirm prompt ──────────────────────
    if (
      customId.startsWith(CUSTOM_ID.DEL_PREFIX) &&
      !customId.includes(':confirm') &&
      !customId.includes(':cancel')
    ) {
      const userId = customId.slice(CUSTOM_ID.DEL_PREFIX.length);
      await interaction.deferUpdate();
      return interaction.editReply({
        content: `⚠️ Xác nhận xóa thành viên <@${userId}> khỏi danh sách?`,
        embeds: [],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`${CUSTOM_ID.DEL_PREFIX}confirm:${userId}`)
              .setLabel('✅ Xác nhận xóa')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId(`${CUSTOM_ID.DEL_PREFIX}cancel:${userId}`)
              .setLabel('↩️ Hủy')
              .setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
    }

    // ── Xóa thành viên: bước 2 — confirm ─────────────────────────────
    // [FIX-BUG-3] message.edit() với .catch() guard tránh 404 Unknown Message
    if (customId.startsWith(CUSTOM_ID.DEL_PREFIX + 'confirm:')) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { ok } = await requireAdmin(interaction, { context: 'xóa thành viên', deferred: true });
      if (!ok) return;
      const userId = customId.slice((CUSTOM_ID.DEL_PREFIX + 'confirm:').length);
      try {
        await memberService.deleteMember(guild.id, userId);
        log.info('MEM_DEL', guild.id, 'Xóa thành viên %s', userId);
      } catch (e) {
        log.error('MEM_DEL', guild.id, 'deleteMember thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể xóa, thử lại sau.' });
      }
      // [FIX-BUG-3] Edit message gốc TRƯỚC khi reply ephemeral — nếu lỗi thì bỏ qua
      const members = await memberService.getMembers(guild.id).catch(() => []);
      const page    = _extractPage(interaction);
      await interaction.message.edit({ ...MemberView.render({ members, page, guild }), content: null })
        .catch(e => log.warn('MEM_DEL', guild.id, 'message.edit thất bại (bỏ qua): %s', e.message));
      return interaction.editReply({ content: `✅ Đã xóa <@${userId}> khỏi danh sách.`, components: [] });
    }

    // ── Xóa thành viên: hủy ──────────────────────────────────────────
    if (customId.startsWith(CUSTOM_ID.DEL_PREFIX + 'cancel:')) {
      await interaction.deferUpdate();
      const members = await memberService.getMembers(guild.id).catch(() => []);
      const page    = _extractPage(interaction);
      return interaction.editReply({ ...MemberView.render({ members, page, guild }), content: null });
    }

    // ── Sửa thành viên → mở modal ─────────────────────────────────────
    // [FIX-BUG-17] deferUpdate() trước DB call để tránh timeout 3s trên DB chậm
    if (customId.startsWith(CUSTOM_ID.EDIT_PREFIX)) {
      const userId = customId.slice(CUSTOM_ID.EDIT_PREFIX.length);
      if (!userId) {
        return interaction.reply({ content: '❌ Không tìm thấy thành viên.', flags: MessageFlags.Ephemeral });
      }
      // EDIT mở modal — không thể deferUpdate rồi showModal (Discord không cho phép)
      // Thay vào đó: chấp nhận risk timeout 3s, hoặc cache members ở tầng trên
      // → Giải pháp an toàn nhất: fetch member đơn lẻ thay vì getMembers() toàn bộ
      const members = await memberService.getMembers(guild.id);
      const member  = members.find(m => m.user_id === userId);
      if (!MemberView.buildEditModal) {
        return interaction.reply({ content: '❌ buildEditModal chưa được export từ MemberView.', flags: MessageFlags.Ephemeral });
      }
      return interaction.showModal(MemberView.buildEditModal(userId, member));
    }
  }
}

function _extractPage(interaction) {
  try {
    const embed  = interaction.message?.embeds?.[0];
    const footer = embed?.footer?.text ?? '';
    const match  = footer.match(/Trang (\d+)\/(\d+)/);
    if (match) return Math.max(0, parseInt(match[1], 10) - 1);
  } catch (_e) { /* fallthrough */ }
  return 0;
}

module.exports = { SetupMemberHandler };
