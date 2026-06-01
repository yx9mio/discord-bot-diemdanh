'use strict';
const { Listener, Events, UserError } = require('@sapphire/framework');
const { replyErr } = require('../utils/embeds.js');

class CommandErrorListener extends Listener {
  constructor(context) { super(context, { event: Events.ChatInputCommandError }); }
  async run(error, { interaction }) {
    this.container.logger.error('[CommandError]', error);
    const msg = error instanceof UserError ? error.message : 'Có lỗi xảy ra. Vui lòng thử lại.';
    const reply = replyErr(msg);
    if (interaction.deferred || interaction.replied) await interaction.editReply(reply).catch(() => null);
    else await interaction.reply(reply).catch(() => null);
  }
}
module.exports = { CommandErrorListener };
