'use strict';
// [BUG-FIX] TTL 15 phút — tránh leak Map entry khi user bỏ dở flow
const _state = new Map();
const TTL_MS = 15 * 60 * 1000;

function _key(guildId, userId, scheduleId) {
  return `${guildId}:${userId}:${scheduleId}`;
}

function _sweep() {
  const now = Date.now();
  for (const [k, v] of _state) {
    if (now - (v._ts ?? 0) > TTL_MS) _state.delete(k);
  }
}

function getState(guildId, userId, scheduleId) {
  _sweep();
  const k = _key(guildId, userId, scheduleId);
  return _state.get(k) ?? null;
}

function setState(guildId, userId, scheduleId, data) {
  _sweep();
  const k = _key(guildId, userId, scheduleId);
  const cur = _state.get(k) ?? {};
  _state.set(k, { ...cur, ...data, guildId, userId, scheduleId, _ts: Date.now() });
}

function clearState(guildId, userId, scheduleId) {
  const k = _key(guildId, userId, scheduleId);
  _state.delete(k);
}

module.exports = { getState, setState, clearState };
