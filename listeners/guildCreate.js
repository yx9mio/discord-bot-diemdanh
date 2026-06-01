// listeners/guildCreate.js
'use strict';
const { Listener, Events } = require('@sapphire/framework');
const db = require('../db.js');

class GuildCreateListener extends Listener {
  constructor(context) {
    super(context, { event: Events.GuildCreate });
  }

  async run(guild) {
    this.container.logger.info(`[GuildCreate] Tham gia server: ${guild.name} (${guild.id})`);
    try {
      await db.ensureGuildConfig(guild.id);
    } catch (err) {
      this.container.logger.error('[GuildCreate] ensureGuildConfig thất bại:', err);
    }
  }
}

module.exports = { GuildCreateListener };
