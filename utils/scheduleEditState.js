'use strict';
const _state = new Map();

function _key(guildId, userId, scheduleId) {
  return `${guildId}:${userId}:${scheduleId}`;
}

function getState(guildId, userId, scheduleId) {
  const k = _key(guildId, userId, scheduleId);
  return _state.get(k) ?? null;
}

function setState(guildId, userId, scheduleId, data) {
  const k = _key(guildId, userId, scheduleId);
  const cur = _state.get(k) ?? {};
  _state.set(k, { ...cur, ...data, guildId, userId, scheduleId });
}

function clearState(guildId, userId, scheduleId) {
  const k = _key(guildId, userId, scheduleId);
  _state.delete(k);
}

module.exports = { getState, setState, clearState };
