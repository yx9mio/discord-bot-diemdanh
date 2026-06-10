// src/interaction-handlers/setup/setupHistory.js
// Handles: setup:history, PAGE_NEXT, PAGE_PREV, REFRESH
// [FIX-PATH] '../../../services/' (3 cấp = root, không phải 4 cấp)
// [FIX-METHOD] getSessionsByGuild thay vì getSessionHistory (tên cũ không tồn tại)
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { HistoryView } = require('../../commands/setup/_views/_HistoryView.js');
const sessionService = require('../../services/sessionService.js');
const { CUSTOM_ID } = HistoryView;

class SetupHistoryHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const handled = new Set([CUSTOM_ID.HISTORY, CUSTOM_ID.PAGE_NEXT, CUSTOM_ID.PAGE_PREV, CUSTOM_ID.REFRESH]);
    if (handled.has(interaction.customId)) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferUpdate();
    const { guild, customId } = interaction;

    const footer = interaction.message?.embeds?.[0]?.footer?.text ?? '';
    let currentPage = 0;
    const m = footer.match(/Trang (\d+)\/(\d+)/);
    if (m) currentPage = parseInt(m[1], 10) - 1;

    let nextPage = currentPage;
    if (customId === CUSTOM_ID.PAGE_NEXT) nextPage = currentPage + 1;
    if (customId === CUSTOM_ID.PAGE_PREV) nextPage = currentPage - 1;

    const sessions = await sessionService.getSessionsByGuild(guild.id);
    return interaction.editReply(HistoryView.render(sessions, nextPage));
  }
}

module.exports = { SetupHistoryHandler };
