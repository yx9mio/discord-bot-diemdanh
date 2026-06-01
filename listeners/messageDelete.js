// listeners/messageDelete.js
'use strict';
const { Listener, Events } = require('@sapphire/framework');
const db = require('../db.js');

class MessageDeleteListener extends Listener {
  constructor(context) {
    super(context, { event: Events.MessageDelete });
  }

  async run(message) {
    if (!message.guild) return;
    try {
      const session = await db.getSessionByMessageId(message.id);
      if (!session) return;
      this.container.logger.warn(
        `[MessageDelete] Tin nhắn phiên điểm danh bị xóa: session=${session.id} guild=${message.guild.id}`
      );
      // Không xóa phiên — chỉ log để admin biết
    } catch (err) {
      this.container.logger.error('[MessageDelete]', err);
    }
  }
}

module.exports = { MessageDeleteListener };
