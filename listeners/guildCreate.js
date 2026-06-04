'use strict';
const { Listener, Events } = require('@sapphire/framework');
const { ensureGuildConfig } = require('../services/configService.js'); // [B-5] migrate db.js → services

class GuildCreateListener extends Listener {
  constructor(context) { super(context, { event: Events.GuildCreate }); }
  async run(guild) {
    this.container.logger.info(`[GuildCreate] ${guild.name} (${guild.id})`);
    try { await ensureGuildConfig(guild.id); }
    catch (err) { this.container.logger.error('[GuildCreate]', err); }
  }
}
module.exports = { GuildCreateListener };
