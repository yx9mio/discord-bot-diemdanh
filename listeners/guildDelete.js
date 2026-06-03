'use strict';
const { Listener, Events } = require('@sapphire/framework');
const log = require('../utils/logger.js');
const { xoaHenGio, stopAutoRefresh } = require('../utils/timers.js');
const { cancelLichCoDinh } = require('../utils/scheduler.js');

class GuildDeleteListener extends Listener {
  constructor(context) {
    super(context, { event: Events.GuildDelete });
  }

  async run(guild) {
    log.info('GUILD_DELETE', guild.id, 'Bot rời guild %s (%s), dọn dẹp timers...', guild.name, guild.id);
    xoaHenGio(guild.id);
    const db_ = require('../db.js');
    const activeSession = await db_.getActiveSession(guild.id).catch(() => null);
    if (activeSession) stopAutoRefresh(activeSession.id);
    const lichList = await db_.getLichCoDinh(guild.id).catch(() => []);
    for (const lich of lichList) {
      cancelLichCoDinh(guild.id, lich.id);
    }
  }
}

module.exports = { GuildDeleteListener };
