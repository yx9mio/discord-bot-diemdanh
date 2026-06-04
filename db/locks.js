// db/locks.js — Advisory lock helpers (distributed attendance lock)
'use strict';
const crypto = require('crypto');
const log = require('../utils/logger.js');

function _throwSupabase(error, ctx) {
  if (error) {
    log.error('DB', null, '[%s] %s', ctx, error.message);
    throw new Error(`[DB:${ctx}] ${error.message}`);
  }
}

function _hashString(str) {
  const hash = crypto.createHash('md5').update(str).digest();
  return hash.readUInt32BE(0);
}

async function tryAcquireAttendanceLock(getClient, sessionId, userId) {
  const key1 = _hashString(sessionId);
  const key2 = _hashString(userId);
  const { data, error } = await getClient().rpc('try_advisory_lock', { key1, key2 });
  _throwSupabase(error, 'tryAcquireAttendanceLock');
  return data === true;
}

async function releaseAttendanceLock(getClient, sessionId, userId) {
  const key1 = _hashString(sessionId);
  const key2 = _hashString(userId);
  const { data, error } = await getClient().rpc('advisory_unlock', { key1, key2 });
  _throwSupabase(error, 'releaseAttendanceLock');
  return data === true;
}

module.exports = { tryAcquireAttendanceLock, releaseAttendanceLock };
