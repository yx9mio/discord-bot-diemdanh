'use strict';
const log = require('./logger.js');
const { replyErrEdit } = require('./embeds.js');
const { captureError, withInteractionSpan } = require('./sentry.js');

/**
 * Bọc một interaction handler: chạy trong transaction span (per-interaction),
 * gắn context guild/user/channel, và capture lỗi với stack lên Sentry.
 * @param {Function} fn
 * @param {string} context — tên handler (dùng cho tag/span name)
 * @param {{op?: string, sessionId?: string}} [opts]
 */
function wrapHandler(fn, context, opts = {}) {
  return (...args) => {
    const interaction = args[0];
    return withInteractionSpan({ interaction, handler: context, op: opts.op }, async () => {
      try {
        return await fn(...args);
      } catch (e) {
        const guildId = interaction?.guild?.id ?? interaction?.guildId;
        const userId  = interaction?.user?.id ?? interaction?.member?.id;
        const sessionId = opts?.sessionId;

        log.error(context, guildId, '%s: %s', context, e.message);
        captureError(e, context, { guildId, userId, sessionId, handler: context });

        if (interaction?.deferred && interaction?.editReply) {
          return interaction.editReply(replyErrEdit('❌ ' + e.message));
        }
        if (interaction?.reply) {
          return interaction.reply({ ...replyErrEdit('❌ ' + e.message), ephemeral: true });
        }
      }
    });
  };
}

module.exports = { wrapHandler };
