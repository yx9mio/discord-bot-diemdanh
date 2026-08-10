'use strict';
const pino = require('pino');
const { captureError, captureMessage } = require('./sentry.js');

const IS_DEV = process.env.NODE_ENV !== 'production';

const transport = IS_DEV
  ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } }
  : { target: 'pino/file', options: { destination: 1 }, level: process.env.LOG_LEVEL ?? 'info' };

const _root = pino({ level: process.env.LOG_LEVEL ?? (IS_DEV ? 'debug' : 'info') }, pino.transport(transport));

function child(module, guildId) {
  return _root.child({ module, guildId: guildId ?? undefined });
}

// Forward pino error → Sentry (không log PII: chỉ module + message)
// Trừ các lỗi crash toàn cục — index.js đã capture riêng bằng captureError (có stack).
function _forwardError(module, guildId, args) {
  const msg = typeof args[0] === 'string' ? args[0] : String(args[0] ?? '');
  if (module === 'SYSTEM' && /^(unhandledRejection|uncaughtException)/.test(msg)) return;
  captureMessage(msg, module, 'error');
}

const _compat = {
  info:  (mod, gId, ...a) => child(mod, gId).info(...a),
  warn:  (mod, gId, ...a) => child(mod, gId).warn(...a),
  error: (mod, gId, ...a) => { child(mod, gId).error(...a); _forwardError(mod, gId, a); },
  debug: (mod, gId, ...a) => child(mod, gId).debug(...a),
};

module.exports = Object.assign(_compat, { root: _root, child });
