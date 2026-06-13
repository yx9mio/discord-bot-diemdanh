'use strict';
const { Listener, Events } = require('@sapphire/framework');
const { upsertEmoji } = require('../../services/guildEmojiService.js');

class EmojiUpdateListener extends Listener {
  constructor(context) {
    super(context, { event: Events.GuildEmojiUpdate });
  }

  async run(_oldEmoji, newEmoji) {
    await upsertEmoji(newEmoji);
  }
}

module.exports = { EmojiUpdateListener };
