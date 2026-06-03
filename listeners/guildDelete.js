'use strict';
const { Listener, Events } = require('@sapphire/framework');
const log = require('../utils/logger.js');
const { xoaHenGio, stopAllAutoRefresh } = require('../utils/timers.js');
const { cancelLichCoDinh } = require('../utils/scheduler.js');

class GuildDeleteListener extends Listener {
  constructor(context) {
    super(context, { event: Events.GuildDelete });
  }

  async run(guild) {
    log.info('GUILD_DELETE', guild.id, 'Bot rời guild %s (%s), dọn dẹp timers...', guild.name, guild.id);
    xoaHenGio(guild.id);
    stopAllAutoRefresh();
    const lichList = await require('../db.js').getLichCoDinh(guild.id).catch(() => []);
    for (const lich of lichList) {
      cancelLichCoDinh(guild.id, lich.id);
    }
  }
}

module.exports = { GuildDeleteListener };
