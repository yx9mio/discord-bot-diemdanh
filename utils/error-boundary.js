'use strict';
const log = require('./logger.js');
const { replyErrEdit } = require('./embeds.js');

function wrapHandler(fn, context) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (e) {
      const interaction = args[0];
      const guildId = interaction?.guild?.id ?? interaction?.guildId;
      log.error(context, guildId, '%s: %s', context, e.message);
      if (interaction?.deferred && interaction?.editReply) {
        return interaction.editReply(replyErrEdit('❌ ' + e.message));
      }
      if (interaction?.reply) {
        return interaction.reply({ ...replyErrEdit('❌ ' + e.message), ephemeral: true });
      }
    }
  };
}

module.exports = { wrapHandler };
