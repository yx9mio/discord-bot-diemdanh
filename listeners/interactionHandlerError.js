// listeners/interactionHandlerError.js — Bắt lỗi từ InteractionHandlers (buttons, selects, modals)
'use strict';
const { Listener, Events } = require('@sapphire/framework');
const { replyErr } = require('../utils/embeds.js');

class InteractionHandlerErrorListener extends Listener {
  constructor(context) {
    super(context, { event: Events.InteractionHandlerError });
  }

  async run(error, { interaction }) {
    this.container.logger.error('[InteractionHandlerError]', error);
    const msg = error instanceof Error ? error.message : 'Có lỗi xảy ra.';
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply(replyErr(msg)).catch(() => null);
    }
  }
}

module.exports = { InteractionHandlerErrorListener };
