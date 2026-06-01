// listeners/commandError.js — Bắt lỗi từ precondition (UserError) và runtime errors
'use strict';
const { Listener, Events, UserError } = require('@sapphire/framework');
const { replyErr } = require('../utils/embeds.js');

class CommandErrorListener extends Listener {
  constructor(context) {
    super(context, { event: Events.ChatInputCommandError });
  }

  async run(error, { interaction }) {
    this.container.logger.error('[CommandError]', error);

    const msg = error instanceof UserError
      ? error.message
      : 'Có lỗi xảy ra. Vui lòng thử lại.';

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(replyErr(msg)).catch(() => null);
    } else {
      await interaction.reply(replyErr(msg)).catch(() => null);
    }
  }
}

module.exports = { CommandErrorListener };
