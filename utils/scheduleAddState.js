'use strict';
const _state = new Map();

function _key(guildId, userId) {
  return `${guildId}:${userId}`;
}

function getState(guildId, userId) {
  const k = _key(guildId, userId);
  return _state.get(k) ?? { step: 1, day: null, hour: null, minute: null, duration: null, channel: null, closeDayOffset: null, closeHour: null, closeMinute: null };
}

function setState(guildId, userId, data) {
  const k = _key(guildId, userId);
  const cur = _state.get(k) ?? {};
  _state.set(k, { ...cur, ...data, guildId, userId });
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
