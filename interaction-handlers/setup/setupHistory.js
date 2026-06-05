'use strict';
// [FIX-DB] Thay db.js → sessionService + [REFRESH-ALL] wire refresh
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const sessionService = require('../../services/sessionService.js');
const { HistoryView } = require('../../src/commands/setup/_views/_HistoryView.js'); // [FIX-SETUP]
const { CUSTOM_ID } = HistoryView;

class SetupHistoryHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === 'setup:history') return this.some();
    if (id === CUSTOM_ID.PAGE_NEXT || id === CUSTOM_ID.PAGE_PREV) return this.some();
    if (id === CUSTOM_ID.REFRESH) return this.some(); // [REFRESH-ALL]
    return this.none();
  }

  async run(interaction) {
    const { customId, guild } = interaction;

    // [REFRESH-ALL] Làm mới trang hiện tại
    if (customId === CUSTOM_ID.REFRESH) {
      const page = _extractPageFromEmbed(interaction);
      return HistoryView.handleRefresh(interaction, page);
    }

    await interaction.deferUpdate();
    const sessions = await sessionService.getAllSessions(guild.id);
    const curPage = _extractPageFromEmbed(interaction);
    const newPage = Math.max(0, curPage + (customId === CUSTOM_ID.PAGE_NEXT ? 1 : -1));
    return interaction.editReply(HistoryView.render({ sessions, page: newPage, guild }));
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

module.exports = { SetupHistoryHandler };
