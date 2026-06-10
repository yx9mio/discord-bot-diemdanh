'use strict';
const { Listener, Events, UserError } = require('@sapphire/framework');
const { replyErr } = require('../../utils/embeds.js');
const metrics = require('../../utils/metrics.js'); // [Phase C]

// [FIX] Guard stale interaction codes — bỏ qua im lặng
const STALE_CODES = new Set([10062, 40060]);

class CommandErrorListener extends Listener {
  constructor(context) { super(context, { event: Events.ChatInputCommandError }); }
  async run(error, { interaction }) {
    // [FIX] Stale interaction sau restart — bỏ qua
    if (STALE_CODES.has(error?.code)) {
      this.container.logger.warn(
        '[CommandError] Stale interaction bỏ qua (code %d): %s',
        error.code,
        interaction?.commandName ?? 'unknown',
      );
      return;
    }

    this.container.logger.error('[CommandError]', error);

    // [Phase C] Metric: command lỗi
    const commandName = interaction?.commandName ?? 'unknown';
    const guildId = interaction?.guildId ?? 'unknown';
    metrics.commandError(commandName, guildId);

    const msg = error instanceof UserError ? error.message : 'Có lỗi xảy ra. Vui lòng thử lại.';
    const reply = replyErr(msg);
    try {
      if (interaction.deferred || interaction.replied) await interaction.editReply(reply);
      else await interaction.reply(reply);
    } catch (e) {
      if (!STALE_CODES.has(e?.code)) {
        this.container.logger.warn('[CommandError] Không thể reply lỗi: %s', e?.message);
      }
    }
  }
}
module.exports = { CommandErrorListener };
