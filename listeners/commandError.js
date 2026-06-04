'use strict';
const { Listener, Events, UserError } = require('@sapphire/framework');
const { replyErr } = require('../utils/embeds.js');
const metrics = require('../utils/metrics.js'); // [Phase C]

class CommandErrorListener extends Listener {
  constructor(context) { super(context, { event: Events.ChatInputCommandError }); }
  async run(error, { interaction }) {
    this.container.logger.error('[CommandError]', error);

    // [Phase C] Metric: command lỗi
    const commandName = interaction?.commandName ?? 'unknown';
    const guildId = interaction?.guildId ?? 'unknown';
    metrics.commandError(commandName, guildId);

    const msg = error instanceof UserError ? error.message : 'Có lỗi xảy ra. Vui lòng thử lại.';
    const reply = replyErr(msg);
    if (interaction.deferred || interaction.replied) await interaction.editReply(reply).catch(() => null);
    else await interaction.reply(reply).catch(() => null);
  }
}
module.exports = { CommandErrorListener };
