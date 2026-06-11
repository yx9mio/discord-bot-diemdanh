'use strict';
const log = require('./logger.js');

async function getSessionChannel(guild, session) {
  if (!session?.channel_id) return null;
  const cached = guild.channels.cache.get(session.channel_id);
  if (cached) return cached;
  log.warn('CHANNEL', guild.id, 'Channel %s not in cache, fetching...', session.channel_id);
  const fetched = await guild.channels.fetch(session.channel_id).catch(() => null);
  return fetched;
}

module.exports = { getSessionChannel };
