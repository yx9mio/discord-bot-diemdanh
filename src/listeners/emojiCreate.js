'use strict';
const { Listener, Events } = require('@sapphire/framework');
const { upsertEmoji } = require('../../services/guildEmojiService.js');

class EmojiCreateListener extends Listener {
  constructor(context) {
    super(context, { event: Events.GuildEmojiCreate });
  }

  async run(emoji) {
    await upsertEmoji(emoji);
  }
}

module.exports = { EmojiCreateListener };
