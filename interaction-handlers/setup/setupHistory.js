'use strict';
// [FIX-DB] Thay db.js → sessionService
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const sessionService = require('../../services/sessionService.js');
const { HistoryView } = require('../../src/commands/setup/_HistoryView.js');
const { CUSTOM_ID } = HistoryView;

class SetupHistoryHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === 'setup:history') return this.some();
    if (id === CUSTOM_ID.PAGE_NEXT || id === CUSTOM_ID.PAGE_PREV) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferUpdate();
    const { guild } = interaction;
    const sessions = await sessionService.getAllSessions(guild.id);
    const curPage = _extractPageFromEmbed(interaction);
    const newPage = Math.max(0, curPage + (interaction.customId === CUSTOM_ID.PAGE_NEXT ? 1 : -1));
    const view = HistoryView.render({ sessions, page: newPage, guild });
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

module.exports = { SetupHistoryHandler };
