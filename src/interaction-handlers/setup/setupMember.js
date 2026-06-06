'use strict';
// interaction-handlers/setup/setupMember.js
// [FIX] Sync toàn bộ custom IDs với _MemberView.CUSTOM_ID
// [BUG-A] DEL_confirm: deferReply ephemeral thay vì deferUpdate để requireAdmin lỗi không overwrite message gốc
// [BUG-B] Typo "Xác nhậnminh" → "Xác nhận"
// [BUG-C] DEL prompt: deferUpdate+editReply thay vì reply() để tránh tạo 2 ephemeral messages
const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const memberService = require('../../../services/memberService.js');
const log = require('../../../utils/logger.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { MemberView } = require('../../commands/setup/_views/_MemberView.js');

const { CUSTOM_ID } = MemberView;

class SetupMemberHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === 'setup:member') return this.some();           // entry point từ dashboard
    if (id === CUSTOM_ID.PAGE_PREV)    return this.some();
    if (id === CUSTOM_ID.PAGE_NEXT)    return this.some();
    if (id === CUSTOM_ID.REFRESH)      return this.some();
    if (id?.startsWith(CUSTOM_ID.DEL_PREFIX)  && !id.includes(':confirm') && !id.includes(':cancel')) return this.some();
    if (id?.startsWith(CUSTOM_ID.EDIT_PREFIX)) return this.some();
    if (id?.startsWith(CUSTOM_ID.DEL_PREFIX + 'confirm:')) return this.some();
    if (id?.startsWith(CUSTOM_ID.DEL_PREFIX + 'cancel:'))  return this.some();
    return this.none();
  }

  async run(interaction) {
    const { customId, guild } = interaction;

    // --- Entry point từ Dashboard ---
    if (customId === 'setup:member') {
      await interaction.deferUpdate();
      const members = await memberService.getMembers(guild.id);
      return interaction.editReply(MemberView.render({ members, page: 0, guild }));
    }

    // --- Phân trang ---
    if (customId === CUSTOM_ID.PAGE_PREV || customId === CUSTOM_ID.PAGE_NEXT) {
      await interaction.deferUpdate();
      const members = await memberService.getMembers(guild.id);
      const currentPage = _extractPage(interaction);
      const totalPages  = Math.max(1, Math.ceil(members.length / MemberView.PAGE_SIZE));
      const newPage = customId === CUSTOM_ID.PAGE_PREV
        ? Math.max(0, currentPage - 1)
        : Math.min(totalPages - 1, currentPage + 1);
      return interaction.editReply(MemberView.render({ members, page: newPage, guild }));
    }

    // --- Làm mới ---
    if (customId === CUSTOM_ID.REFRESH) {
      const page = _extractPage(interaction);
      return MemberView.handleRefresh(interaction, page);
    }

    // [BUG-C] Xóa thành viên: mở confirm — dùng deferUpdate+editReply để replace message cũ,
    //         tránh tạo ephemeral message thứ hai
    if (
      customId.startsWith(CUSTOM_ID.DEL_PREFIX) &&
      !customId.includes(':confirm') &&
      !customId.includes(':cancel')
    ) {
      const userId = customId.slice(CUSTOM_ID.DEL_PREFIX.length);
      await interaction.deferUpdate();
      // [BUG-B] Sửa typo "Xác nhậnminh" → "Xác nhận"
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

    // [BUG-A] Xóa: xác nhận — deferReply ephemeral để requireAdmin lỗi không overwrite message danh sách
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
      // Xóa thành công: dismiss ephemeral reply và cập nhật message danh sách
      await interaction.deleteReply();
      const members = await memberService.getMembers(guild.id).catch(() => []);
      const page = _extractPage(interaction);
      return interaction.message.edit({ ...MemberView.render({ members, page, guild }), content: undefined });
    }

    // Xóa: hủy — dismiss confirm prompt, khôi phục danh sách
    if (customId.startsWith(CUSTOM_ID.DEL_PREFIX + 'cancel:')) {
      await interaction.deferUpdate();
      const members = await memberService.getMembers(guild.id).catch(() => []);
      const page = _extractPage(interaction);
      return interaction.editReply({ ...MemberView.render({ members, page, guild }), content: undefined });
    }

    // --- Chỉnh sửa thành viên ---
    if (customId.startsWith(CUSTOM_ID.EDIT_PREFIX)) {
      const userId = customId.slice(CUSTOM_ID.EDIT_PREFIX.length);
      if (!userId) return interaction.reply({ content: '❌ Không tìm thấy thành viên.', flags: MessageFlags.Ephemeral });
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
