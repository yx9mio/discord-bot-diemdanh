'use strict';
const { Listener, Events } = require('@sapphire/framework');
const { deleteEmoji } = require('../../services/guildEmojiService.js');

class EmojiDeleteListener extends Listener {
  constructor(context) {
    super(context, { event: Events.GuildEmojiDelete });
  }

  async run(emoji) {
    await deleteEmoji(emoji);
  }
}

module.exports = { EmojiDeleteListener };
