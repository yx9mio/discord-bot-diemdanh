'use strict';
const _state = new Map();

function _key(guildId, scheduleId) {
  return `${guildId}:${scheduleId}`;
}

function getState(guildId, scheduleId) {
  const k = _key(guildId, scheduleId);
  return _state.get(k) ?? null;
}

function setState(guildId, scheduleId, data) {
  const k = _key(guildId, scheduleId);
  const cur = _state.get(k) ?? {};
  _state.set(k, { ...cur, ...data, guildId, scheduleId });
}

function clearState(guildId, scheduleId) {
  const k = _key(guildId, scheduleId);
  _state.delete(k);
}

module.exports = { getState, setState, clearState };
