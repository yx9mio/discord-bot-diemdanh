'use strict';
const { Listener, Events } = require('@sapphire/framework');
const { getSessionByMessageId } = require('../../services/sessionService.js'); // [B-5]

class MessageDeleteListener extends Listener {
  constructor(context) { super(context, { event: Events.MessageDelete }); }
  async run(message) {
    if (!message.guild) return;
    try {
      const session = await getSessionByMessageId(message.id);
      if (!session) return;
      this.container.logger.warn(`[MessageDelete] phiên=${session.id} guild=${message.guild.id}`);
    } catch (err) { this.container.logger.error('[MessageDelete]', err); }
  }
}
module.exports = { MessageDeleteListener };
