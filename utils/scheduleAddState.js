'use strict';
const _state = new Map();

function getState(guildId) {
  return _state.get(guildId) ?? { step: 1, day: null, hour: null, minute: null, duration: null, channel: null, closeDayOffset: null, closeHour: null, closeMinute: null };
}

function setState(guildId, data) {
  const cur = getState(guildId);
  _state.set(guildId, { ...cur, ...data });
}

function clearState(guildId) {
  _state.delete(guildId);
}

function isComplete(guildId) {
  const s = getState(guildId);
  if (s.day == null || s.hour == null || s.minute == null) return false;
  if (s.closeDayOffset === '-1') return true;
  return s.closeDayOffset != null && s.closeHour != null && s.closeMinute != null;
}

module.exports = { getState, setState, clearState, isComplete };
