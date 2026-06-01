// utils/logger.js — Pino structured logger
// Dev: pipe sang `pino-pretty` với  |  npm run dev 2>&1 | npx pino-pretty
// Prod: JSON lines sang stdout, ingest vào Loki / Datadog / papertrail
'use strict';
const pino = require('pino');

const IS_DEV = process.env.NODE_ENV !== 'production';

const _root = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(IS_DEV ? {
    transport: {
      target:  'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
    },
  } : {}),
});

/**
 * Tạo child logger với context cố định.
 * @param {string} module   — tên module, vd: 'SCHEDULER', 'SESSION'
 * @param {string|null} guildId
 */
function child(module, guildId) {
  return _root.child({ module, guildId: guildId ?? undefined });
}

// Backward-compat API: log.info('MODULE', guildId, fmt, ...args)
// Dùng printf-style vì codebase hiện tại đã dùng %s
const _compat = {
  info:  (mod, gId, ...a) => child(mod, gId).info(...a),
  warn:  (mod, gId, ...a) => child(mod, gId).warn(...a),
  error: (mod, gId, ...a) => child(mod, gId).error(...a),
  debug: (mod, gId, ...a) => child(mod, gId).debug(...a),
};

// Export root + compat layer — caller không cần thay đổi call-site
module.exports = Object.assign(_compat, { root: _root, child });
