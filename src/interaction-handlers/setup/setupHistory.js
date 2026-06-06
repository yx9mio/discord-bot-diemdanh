// interaction-handlers/setup/setupHistory.js
// Handles: setup:history, PAGE_NEXT, PAGE_PREV, REFRESH
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { HistoryView } = require('../../commands/setup/_views/_HistoryView.js');
const sessionService = require('../../../services/sessionService.js');

const { CUSTOM_ID, PAGE_SIZE } = HistoryView;

const HANDLED_IDS = new Set([
  'setup:history',
  CUSTOM_ID.PAGE_NEXT,
  CUSTOM_ID.PAGE_PREV,
  CUSTOM_ID.REFRESH,
]);

class SetupHistoryHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (HANDLED_IDS.has(interaction.customId)) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferUpdate();
    const { guild } = interaction;
    const cid = interaction.customId;

    // Đọc trang hiện tại từ embed footer nếu có
    let currentPage = 0;
    try {
      const footer = interaction.message?.embeds?.[0]?.footer?.text ?? '';
      const m = footer.match(/Trang (\d+)\/(\d+)/);
      if (m) currentPage = parseInt(m[1], 10) - 1;
    } catch { /* ignore */ }

    const page =
      cid === CUSTOM_ID.PAGE_NEXT ? currentPage + 1 :
      cid === CUSTOM_ID.PAGE_PREV ? currentPage - 1 :
      0; // setup:history và REFRESH luôn về trang đầu

    const sessions = await sessionService.getAllSessions(guild.id).catch(() => []);
    return interaction.editReply(HistoryView.render({ sessions, page, guild }));
  }
}

module.exports = { SetupHistoryHandler };
