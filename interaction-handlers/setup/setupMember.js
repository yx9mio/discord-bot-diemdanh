// interaction-handlers/setup/setupMember.js
// [FIX] Thêm confirm step trước xóa + fix silent fail + wire REFRESH
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const memberService = require('../../services/memberService.js');
const log = require('../../utils/logger.js');
const { MemberView } = require('../../src/commands/setup/_views/_MemberView.js'); // [FIX-SETUP]
const { CUSTOM_ID } = MemberView;

const DEL_CONFIRM_PREFIX = 'setup:mem:del:confirm:';
const DEL_CANCEL_PREFIX  = 'setup:mem:del:cancel:';

class SetupMemberHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === 'setup:mem') return this.some();
    if (id === CUSTOM_ID.PAGE_NEXT || id === CUSTOM_ID.PAGE_PREV) return this.some();
    if (id === CUSTOM_ID.REFRESH) return this.some(); // [REFRESH-ALL]
    if (id?.startsWith(CUSTOM_ID.DEL_PREFIX)) return this.some();
    if (id?.startsWith(DEL_CONFIRM_PREFIX)) return this.some();
    if (id?.startsWith(DEL_CANCEL_PREFIX)) return this.some();
    return this.none();
  }

  async run(interaction) {
    const { customId, guild } = interaction;

    // [REFRESH-ALL] Làm mới trang hiện tại
    if (customId === CUSTOM_ID.REFRESH) {
      const page = _extractPageFromEmbed(interaction);
      return MemberView.handleRefresh(interaction, page);
    }

    // Bước 1: Nhấn nút ✕ → hiện confirm prompt (ephemeral)
    if (
      customId.startsWith(CUSTOM_ID.DEL_PREFIX) &&
      !customId.startsWith(DEL_CONFIRM_PREFIX) &&
      !customId.startsWith(DEL_CANCEL_PREFIX)
    ) {
      const userId = customId.slice(CUSTOM_ID.DEL_PREFIX.length);
      await interaction.reply({
        content: `⚠️ Xác nhận xóa <@${userId}> khỏi danh sách quản lý? Streak và lịch sử sẽ giữ nguyên.`,
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
      return;
    }

    // Bước 2b: Hủy xóa
    if (customId.startsWith(DEL_CANCEL_PREFIX)) {
      await interaction.deferUpdate();
      return interaction.editReply({ content: '↩️ Đã hủy.', components: [] });
    }

    // Bước 2a: Xác nhận xóa
    if (customId.startsWith(DEL_CONFIRM_PREFIX)) {
      await interaction.deferUpdate();
      const userId = customId.slice(DEL_CONFIRM_PREFIX.length);
      try {
        await memberService.deleteMember(guild.id, userId);
        log.info('SETUP_MEM', guild.id, 'Xóa thành viên %s qua /setup', userId);
      } catch (e) {
        log.error('SETUP_MEM', guild.id, 'deleteMember thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể xóa thành viên, thử lại sau.', components: [] });
      }
      await interaction.editReply({ content: `✅ Đã xóa <@${userId}> khỏi danh sách.`, components: [] });
      try {
        const members = await memberService.getMembers(guild.id);
        const currentPage = _extractPageFromEmbed(interaction);
        const view = MemberView.render({ members, page: currentPage, guild });
        await interaction.message?.edit(view).catch(() => null);
      } catch (_e) { /* fallthrough */ }
      return;
    }

    // Pagination + mở trang member
    await interaction.deferUpdate();
    const members = await memberService.getMembers(guild.id);
    const curPage = _extractPageFromEmbed(interaction);
    const newPage = customId === CUSTOM_ID.PAGE_NEXT
      ? Math.min(curPage + 1, Math.ceil(members.length / MemberView.PAGE_SIZE) - 1)
      : Math.max(0, curPage - 1);
    return interaction.editReply(MemberView.render({ members, page: newPage, guild }));
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

module.exports = { SetupMemberHandler };
