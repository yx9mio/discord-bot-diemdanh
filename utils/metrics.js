'use strict';
// utils/metrics.js — Sentry custom metrics (counter/distribution/gauge).
// Nếu Sentry chưa init (thiếu SENTRY_DSN / dev) thì tất cả là no-op an toàn.
const { getMetricsNamespace } = require('./sentry.js');

function _m() {
  return getMetricsNamespace();
}

/** Chuyển object tags -> array "key:value" (chuẩn Sentry metrics). */
function _tags(tags = []) {
  if (Array.isArray(tags)) return tags.filter(Boolean);
  return Object.entries(tags).map(([k, v]) => (v == null || v === false ? '' : `${k}:${v}`)).filter(Boolean);
}

function increment(name, tags = [], value = 1) {
  try {
    const m = _m();
    if (!m) return;
    m.increment(name, value, { tags: _tags(tags) });
  } catch { /* metrics không khả dụng — bỏ qua */ }
}

function gauge(name, value, tags = []) {
  try {
    const m = _m();
    if (!m) return;
    m.gauge(name, value, { tags: _tags(tags) });
  } catch { /* bỏ qua */ }
}

function distribution(name, value, tags = []) {
  try {
    const m = _m();
    if (!m) return;
    m.distribution(name, value, { tags: _tags(tags) });
  } catch { /* bỏ qua */ }
}

function sessionOpened(guildId, { scheduled = false } = {}) {
  increment('bot.session.opened', [`scheduled:${scheduled}`, `guild:${guildId}`]);
}

function sessionClosed(guildId, { cancelled = false } = {}) {
  increment('bot.session.closed', [`cancelled:${cancelled}`, `guild:${guildId}`]);
}

function attendanceMarked(guildId, status, { markedBy = 'self' } = {}) {
  increment('bot.attendance.marked', [`status:${status}`, `marked_by:${markedBy}`, `guild:${guildId}`]);
}

function commandCalled(commandName, guildId) {
  increment('bot.command.called', [`command:${commandName}`, `guild:${guildId}`]);
}

function commandError(commandName, guildId) {
  increment('bot.command.error', [`command:${commandName}`, `guild:${guildId}`]);
}

function sessionMemberCount(guildId, count) {
  distribution('bot.session.members', count, [`guild:${guildId}`]);
}

module.exports = {
  increment, gauge, distribution,
  sessionOpened, sessionClosed, attendanceMarked,
  commandCalled, commandError, sessionMemberCount,
};
