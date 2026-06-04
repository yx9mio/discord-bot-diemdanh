// interaction-handlers/setup/setupMember.js
// [FIX-DB] Thay db.js → memberService
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const memberService = require('../../services/memberService.js');
const log = require('../../utils/logger.js');
const { MemberView } = require('../../src/commands/setup/_MemberView.js');
const { CUSTOM_ID } = MemberView;

class SetupMemberHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === 'setup:mem') return this.some();
    if (id === CUSTOM_ID.PAGE_NEXT || id === CUSTOM_ID.PAGE_PREV) return this.some();
    if (id?.startsWith(CUSTOM_ID.DEL_PREFIX)) return this.some();
    return this.none();
  }

  async run(interaction) {
    const { customId, guild } = interaction;
    await interaction.deferUpdate();

    if (customId.startsWith(CUSTOM_ID.DEL_PREFIX)) {
      const userId = customId.slice(CUSTOM_ID.DEL_PREFIX.length);
      try {
        await memberService.deleteMember(guild.id, userId);
        log.info('SETUP_MEM', guild.id, 'Xoá thành viên %s qua /setup', userId);
      } catch (e) {
        log.error('SETUP_MEM', guild.id, 'deleteMember thất bại: %s', e.message);
      }
      const members = await memberService.getMembers(guild.id);
      const currentPage = _extractPageFromEmbed(interaction);
      const view = MemberView.render({ members, page: currentPage, guild });
      return interaction.editReply(view);
    }

    const members = await memberService.getMembers(guild.id);
    const curPage = _extractPageFromEmbed(interaction);
    const newPage = Math.max(0, curPage + (customId === CUSTOM_ID.PAGE_NEXT ? 1 : -1));
    const view = MemberView.render({ members, page: newPage, guild });
    return interaction.editReply(view);
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
