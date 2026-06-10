'use strict';
const { Listener, Events } = require('@sapphire/framework');
const log = require('../../utils/logger.js');
const { cancelTimers, stopAutoRefresh } = require('../../utils/timers.js');
const { clearGuildTimers } = require('../../utils/scheduler.js');
const sessionService   = require('../../services/sessionService.js');

class GuildDeleteListener extends Listener {
  constructor(context) {
    super(context, { event: Events.GuildDelete });
  }

  async run(guild) {
    log.info('GUILD_DELETE', guild.id, 'Bot rời guild %s (%s), dọn dẹp timers...', guild.name, guild.id);
    cancelTimers(guild.id);
    const activeSession = await sessionService.getActiveSession(guild.id).catch(() => null);
    if (activeSession) stopAutoRefresh(activeSession.id);
    clearGuildTimers(guild.id);
  }
}

module.exports = { GuildDeleteListener };
