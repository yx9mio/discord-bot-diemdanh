// interaction-handlers/setup/setupMember.js
// Handles:
//   - setup:mem (mở Member view trang 0)
//   - setup:mem:page:next / :prev (phân trang)
//   - setup:mem:del:<userId> (xoá 1 thành viên)
//   - setup:mem:add → modal ở Commit 5
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const db = require('../../db.js');
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

    // Xoá 1 thành viên
    if (customId.startsWith(CUSTOM_ID.DEL_PREFIX)) {
      const userId = customId.slice(CUSTOM_ID.DEL_PREFIX.length);
      try {
        await db.deleteMember(guild.id, userId);
        log.info('SETUP_MEM', guild.id, 'Xoá thành viên %s qua /setup', userId);
      } catch (e) {
        log.error('SETUP_MEM', guild.id, 'deleteMember thất bại: %s', e.message);
      }
      const members = await db.getMembers(guild.id);
      const currentPage = _extractPageFromEmbed(interaction);
      const view = MemberView.render({ members, page: currentPage, guild });
      return interaction.editReply(view);
    }

    // Phân trang
    const members = await db.getMembers(guild.id);
    const curPage = _extractPageFromEmbed(interaction);

    let newPage = curPage;
    if (customId === CUSTOM_ID.PAGE_NEXT) newPage = curPage + 1;
    if (customId === CUSTOM_ID.PAGE_PREV) newPage = curPage - 1;

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
