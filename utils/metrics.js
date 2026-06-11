'use strict';

function increment(metric, tags = []) {}
function gauge(metric, value, tags = []) {}
function sessionOpened(guildId, { scheduled = false } = {}) {}
function sessionClosed(guildId, { cancelled = false } = {}) {}
function attendanceMarked(guildId, status, { markedBy = 'self' } = {}) {}
function commandCalled(commandName, guildId) {}
function commandError(commandName, guildId) {}
function sessionMemberCount(guildId, count) {}

module.exports = {
  increment, gauge,
  sessionOpened, sessionClosed, attendanceMarked,
  commandCalled, commandError, sessionMemberCount,
};
