// utils/cooldown.js — Per-user rate limiter for interactions
'use strict';
const log = require('./logger.js');

const _buckets = new Map();
const CLEANUP_INTERVAL_MS = 60_000;
let _cleanupTimer = null;

function _startCleanup() {
  if (_cleanupTimer) return;
  _cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, expiry] of _buckets) {
      if (expiry < now) _buckets.delete(key);
    }
  }, CLEANUP_INTERVAL_MS);
  if (_cleanupTimer.unref) _cleanupTimer.unref();
}

/**
 * Check if a user is on cooldown for a given action.
 * @param {string} userId  - Discord user ID
 * @param {string} action  - Action name (e.g. 'attendance', 'admin_mark')
 * @param {number} ms      - Cooldown window in milliseconds (default 2000)
 * @returns {boolean}      - true if action is allowed, false if on cooldown
 */
function checkCooldown(userId, action, ms = 2000) {
  _startCleanup();
  const key = `${userId}:${action}`;
  const now = Date.now();
  const expiry = _buckets.get(key);
  if (expiry && expiry > now) {
    log.debug('COOLDOWN', null, 'User %s blocked on %s (%dms remaining)', userId, action, expiry - now);
    return false;
  }
  _buckets.set(key, now + ms);
  return true;
}

module.exports = { checkCooldown };
