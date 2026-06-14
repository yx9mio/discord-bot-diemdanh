'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { HistoryView } = require('../../commands/setup/_views/_HistoryView.js');
const sessionService = require('../../../services/sessionService.js');
const log = require('../../../utils/logger.js');
const { CUSTOM_ID } = HistoryView;
const { wrapHandler } = require('../../../utils/error-boundary.js');
const { checkCooldown } = require('../../../utils/cooldown.js');

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
    return wrapHandler(async (interaction) => {
    await interaction.deferUpdate();
    if (!checkCooldown(interaction.user.id, 'setup_history', 1000)) return interaction.editReply({ content: '⏳ Vui lòng đợi một chút trước khi thực hiện hành động này.' });
    const { guild, customId } = interaction;

    try {
      const footer = interaction.message?.embeds?.[0]?.footer?.text ?? '';
      let currentPage = 0;
      const m = footer.match(/Trang (\d+)\/(\d+)/);
      if (m) currentPage = parseInt(m[1], 10) - 1;

      let nextPage = currentPage;
      if (customId === CUSTOM_ID.PAGE_NEXT) nextPage = currentPage + 1;
      if (customId === CUSTOM_ID.PAGE_PREV) nextPage = currentPage - 1;

      const sessions = await sessionService.getAllSessions(guild.id);
      return interaction.editReply(HistoryView.render({ sessions, page: nextPage, guild }));
    } catch (e) {
      log.error('HISTORY', guild?.id, 'run thất bại: %s', e?.message ?? e);
      return interaction.editReply({ content: '❌ Không thể tải nhật ký. Vui lòng thử lại sau.', embeds: [], components: [] });
    }
  }, 'SetupHistoryHandler')(interaction); }
}

module.exports = { SetupHistoryHandler };
