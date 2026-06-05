// utils/logger.js — Pino structured logger
// Dev: pipe sang `pino-pretty` |  npm run dev 2>&1 | npx pino-pretty
// Prod: JSON lines stdout + Datadog transport (nếu DD_API_KEY có mặt)
'use strict';
const pino = require('pino');
const os   = require('node:os');

const IS_DEV  = process.env.NODE_ENV !== 'production';
const HAS_DD  = !IS_DEV && !!process.env.DD_API_KEY;
const DD_SITE = process.env.DD_SITE ?? 'ap1.datadoghq.com';
const SERVICE = process.env.DD_SERVICE ?? 'discord-bot-diemdanh';
const VERSION = process.env.DD_VERSION ?? process.env.npm_package_version ?? '0';
const ENV     = process.env.DD_ENV     ?? process.env.NODE_ENV ?? 'production';

// ── Build transport targets ───────────────────────────────────────────────
function buildTransport() {
  if (IS_DEV) {
    return {
      target:  'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
    };
  }

  // Prod: stdout (Railway logs) luôn có
  const targets = [
    {
      target:  'pino/file',
      options: { destination: 1 },
      level:   process.env.LOG_LEVEL ?? 'info',
    },
  ];

  // Datadog transport — chỉ khi có DD_API_KEY
  if (HAS_DD) {
    targets.push({
      target: 'pino-datadog-transport',
      options: {
        ddClientConf: {
          authMethods: { apiKeyAuth: process.env.DD_API_KEY },
        },
        ddServerConf: { site: DD_SITE },
        // [DD-MCP] Các field này giúp Datadog MCP filter chính xác
        ddsource: 'nodejs',
        service:  SERVICE,
        // ddtags chuẩn cho Datadog MCP query: env:production, version:3.0.0, host:...
        ddtags:   `env:${ENV},version:${VERSION},host:${os.hostname()}`,
      },
      level: process.env.LOG_LEVEL ?? 'info',
    });
  }

  return { targets };
}

const _root = pino(
  {
    level: process.env.LOG_LEVEL ?? 'info',
    // Base fields xuất hiện trong mọi log line — Datadog MCP có thể filter theo đây
    base: {
      service: SERVICE,
      env:     ENV,
      version: VERSION,
      host:    os.hostname(),
    },
    // [DATADOG] dd-trace inject trace_id/span_id tự động khi DD_LOG_INJECTION=true
    // Pino format JSON → Datadog tự correlate logs ↔ traces
  },
  pino.transport(buildTransport()),
);

/**
 * Tạo child logger với context cố định.
 * @param {string} module   — tên module, vd: 'SCHEDULER', 'SESSION'
 * @param {string|null} guildId
 */
function child(module, guildId) {
  return _root.child({ module, guildId: guildId ?? undefined });
}

// Backward-compat API: log.info('MODULE', guildId, fmt, ...args)
const _compat = {
  info:  (mod, gId, ...a) => child(mod, gId).info(...a),
  warn:  (mod, gId, ...a) => child(mod, gId).warn(...a),
  error: (mod, gId, ...a) => child(mod, gId).error(...a),
  debug: (mod, gId, ...a) => child(mod, gId).debug(...a),
};

module.exports = Object.assign(_compat, { root: _root, child });
