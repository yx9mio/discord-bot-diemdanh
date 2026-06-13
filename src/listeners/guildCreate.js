'use strict';
const { Listener, Events } = require('@sapphire/framework');
const { ensureGuildConfig } = require('../../services/configService.js');
const { syncGuildEmojis } = require('../../services/guildEmojiService.js');

class GuildCreateListener extends Listener {
  constructor(context) { super(context, { event: Events.GuildCreate }); }
  async run(guild) {
    this.container.logger.info(`[GuildCreate] ${guild.name} (${guild.id})`);
    try { await ensureGuildConfig(guild.id); }
    catch (err) { this.container.logger.error('[GuildCreate]', err); }
    try { await syncGuildEmojis(guild); }
    catch (err) { this.container.logger.warn('[GuildCreate] Emoji sync fail:', err.message); }
  }
}
module.exports = { GuildCreateListener };
