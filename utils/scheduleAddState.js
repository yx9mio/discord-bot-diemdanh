'use strict';
// [BUG-FIX] TTL 15 phút — tránh leak Map entry khi user bỏ dở flow
const _state = new Map();
const TTL_MS = 15 * 60 * 1000;

function _key(guildId, userId) {
  return `${guildId}:${userId}`;
}

function _sweep() {
  const now = Date.now();
  for (const [k, v] of _state) {
    if (now - (v._ts ?? 0) > TTL_MS) _state.delete(k);
  }
}

function getState(guildId, userId) {
  _sweep();
  const k = _key(guildId, userId);
  return _state.get(k) ?? { step: 1, day: null, hour: null, minute: null, duration: null, channel: null, closeDayOffset: null, closeHour: null, closeMinute: null };
}

function setState(guildId, userId, data) {
  _sweep();
  const k = _key(guildId, userId);
  const cur = _state.get(k) ?? {};
  _state.set(k, { ...cur, ...data, guildId, userId, _ts: Date.now() });
}

function clearState(guildId, userId) {
  const k = _key(guildId, userId);
  _state.delete(k);
}

function isComplete(guildId, userId) {
  const s = getState(guildId, userId);
  if (s.day == null || s.hour == null || s.minute == null) return false;
  if (s.closeDayOffset === '-1') return true;
  return s.closeDayOffset != null && s.closeHour != null && s.closeMinute != null;
}

module.exports = { getState, setState, clearState, isComplete };
