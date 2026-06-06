'use strict';
// interaction-handlers/setup/setupMember.js
// [FIX-4] deleteReply() trên ephemeral reply throw 404 → thay bằng editReply content rỗng
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
    if (id === 'setup:member') return this.some();
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

    if (customId === 'setup:member') {
      await interaction.deferUpdate();
      const members = await memberService.getMembers(guild.id);
      return interaction.editReply(MemberView.render({ members, page: 0, guild }));
    }

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

    if (customId === CUSTOM_ID.REFRESH) {
      const page = _extractPage(interaction);
      return MemberView.handleRefresh(interaction, page);
    }

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
      // [FIX-4] deleteReply() trên ephemeral throw DiscordAPIError 404
      //         → dùng editReply xóa nội dung thay thế
      await interaction.editReply({ content: '✅ Đã xóa thành viên.', components: [] });
      const members = await memberService.getMembers(guild.id).catch(() => []);
      const page = _extractPage(interaction);
      return interaction.message.edit({ ...MemberView.render({ members, page, guild }), content: undefined });
    }

    if (customId.startsWith(CUSTOM_ID.DEL_PREFIX + 'cancel:')) {
      await interaction.deferUpdate();
      const members = await memberService.getMembers(guild.id).catch(() => []);
      const page = _extractPage(interaction);
      return interaction.editReply({ ...MemberView.render({ members, page, guild }), content: undefined });
    }

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
