// interaction-handlers/setup/setupHistory.js
// Handles: setup:history + pagination
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const sessionService = require('../../../../services/sessionService.js');
const { HistoryView } = require('../../commands/setup/_views/_HistoryView.js');
const { CUSTOM_ID } = HistoryView;

class SetupHistoryHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === 'setup:history') return this.some();
    if (id === CUSTOM_ID.PAGE_PREV || id === CUSTOM_ID.PAGE_NEXT) return this.some();
    if (id === CUSTOM_ID.REFRESH) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferUpdate();
    const { guild, customId } = interaction;

    if (customId === 'setup:history' || customId === CUSTOM_ID.REFRESH) {
      const sessions = await sessionService.getSessions(guild.id);
      return interaction.editReply(HistoryView.render({ sessions, page: 0, guild }));
    }

    const sessions = await sessionService.getSessions(guild.id);
    const currentPage = _extractPage(interaction);
    const totalPages  = Math.max(1, Math.ceil(sessions.length / HistoryView.PAGE_SIZE));
    const newPage = customId === CUSTOM_ID.PAGE_PREV
      ? Math.max(0, currentPage - 1)
      : Math.min(totalPages - 1, currentPage + 1);
    return interaction.editReply(HistoryView.render({ sessions, page: newPage, guild }));
  }
}

function _extractPage(interaction) {
  try {
    const footer = interaction.message?.embeds?.[0]?.footer?.text ?? '';
    const match  = footer.match(/Trang (\d+)\/(\d+)/);
    if (match) return Math.max(0, parseInt(match[1], 10) - 1);
  } catch { /* fallthrough */ }
  return 0;
}

module.exports = { SetupHistoryHandler };
