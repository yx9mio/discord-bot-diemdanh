// utils/logger.js — Structured logger + Datadog transport
// Usage:
//   const log = require('./utils/logger.js');
//   log.info('SCHEDULER', guildId, 'Đã mở phiên "%s"', session_name);
//   log.warn('READY',     null,    'Không xóa được commands: %s', err.message);
//   log.error('CMD',      guildId, 'Lỗi lệnh /batdau: %s', err.stack);
//   log.debug('DB',       guildId, 'query: %s', sql);
//
// ENV:
//   LOG_LEVEL          — debug | info | warn | error  (default: info)
//   DD_API_KEY         — Datadog API key (bỏ trống để tắt Datadog)
//   DD_SERVICE         — tên service  (default: discord-bot-diemdanh)
//   DD_ENV             — môi trường   (default: production)
//   DD_SITE            — Datadog site (default: datadoghq.com)
//   DD_FLUSH_INTERVAL  — ms giữa các batch flush (default: 5000)
//   DD_BATCH_MAX       — số log tối đa mỗi batch  (default: 100)
'use strict';

const https = require('https');

const LEVEL_RANK = { debug: 0, info: 1, warn: 2, error: 3 };

const _envLevel = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
const MIN_RANK  = LEVEL_RANK[_envLevel] ?? LEVEL_RANK.info;

// ─── Datadog config ───────────────────────────────────────────────────────────
const DD_API_KEY        = process.env.DD_API_KEY ?? '';
const DD_SERVICE        = process.env.DD_SERVICE ?? 'discord-bot-diemdanh';
const DD_ENV            = process.env.DD_ENV     ?? 'production';
const DD_SITE           = process.env.DD_SITE    ?? 'datadoghq.com';
const DD_FLUSH_INTERVAL = parseInt(process.env.DD_FLUSH_INTERVAL ?? '5000', 10);
const DD_BATCH_MAX      = parseInt(process.env.DD_BATCH_MAX      ?? '100',  10);
const DD_ENABLED        = DD_API_KEY.length > 0;

// In-memory ring buffer cho /log command (max 500 entries)
const RING_SIZE = 500;
const _ring = [];

// Batch queue gửi Datadog
let _ddQueue = [];
let _ddTimer = null;

function _scheduleDDFlush() {
  if (_ddTimer) return;
  _ddTimer = setTimeout(() => {
    _ddTimer = null;
    _flushToDatadog();
  }, DD_FLUSH_INTERVAL);
}

function _flushToDatadog() {
  if (!DD_ENABLED || _ddQueue.length === 0) return;
  const batch = _ddQueue.splice(0, DD_BATCH_MAX);
  const body  = JSON.stringify(batch);
  const opts  = {
    hostname: `http-intake.logs.${DD_SITE}`,
    path:     '/api/v2/logs',
    method:   'POST',
    headers:  {
      'Content-Type':   'application/json',
      'DD-API-KEY':     DD_API_KEY,
      'Content-Length': Buffer.byteLength(body),
    },
  };
  const req = https.request(opts, (res) => {
    if (res.statusCode >= 400) {
      process.stderr.write(`[LOGGER] Datadog flush HTTP ${res.statusCode}\n`);
    }
    res.resume();
  });
  req.on('error', (e) => {
    process.stderr.write(`[LOGGER] Datadog flush error: ${e.message}\n`);
    // Đẩy lại vào queue để retry lần sau
    _ddQueue.unshift(...batch);
  });
  req.write(body);
  req.end();
  // Nếu còn dữ liệu trong queue, schedule flush tiếp
  if (_ddQueue.length > 0) _scheduleDDFlush();
}

// Flush ngay khi process thoát
process.on('exit',    () => _flushToDatadog());
process.on('SIGINT',  () => { _flushToDatadog(); process.exit(0); });
process.on('SIGTERM', () => { _flushToDatadog(); process.exit(0); });

// ─── ANSI ─────────────────────────────────────────────────────────────────────
const ANSI = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  debug: '\x1b[35m', info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m',
  guild: '\x1b[32m', tag:  '\x1b[34m',
};

function _timestamp() {
  return new Date().toLocaleTimeString('vi-VN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Ho_Chi_Minh',
  });
}

function _buildLine(level, tag, guildId, msg) {
  const ts  = `${ANSI.dim}[${_timestamp()}]${ANSI.reset}`;
  const lv  = `${ANSI[level] ?? ''}${ANSI.bold}[${level.toUpperCase().padEnd(5)}]${ANSI.reset}`;
  const tg  = `${ANSI.tag}[${tag}]${ANSI.reset}`;
  const gld = guildId ? `${ANSI.guild}[${guildId}]${ANSI.reset} ` : '';
  return `${ts} ${lv} ${tg} ${gld}${msg}`;
}

function _resolveMsg(args) {
  if (args.length === 0) return '';
  if (args.length === 1) return String(args[0] ?? '');
  if (typeof args[0] === 'string' && args[0].includes('%s')) {
    let i = 1;
    return args[0].replace(/%s/g, () => String(args[i++] ?? ''));
  }
  return args.map(a => (a instanceof Error ? a.stack ?? a.message : String(a ?? ''))).join(' ');
}

// ─── Core log fn ─────────────────────────────────────────────────────────────
function log(level, tag, guildId, ...args) {
  if ((LEVEL_RANK[level] ?? 0) < MIN_RANK) return;

  const msg  = _resolveMsg(args);
  const line = _buildLine(level, tag, guildId, msg);
  const iso  = new Date().toISOString();

  // 1. stdout / stderr
  if (level === 'error') process.stderr.write(line + '\n');
  else                   process.stdout.write(line + '\n');

  // 2. In-memory ring buffer (dùng cho /log command)
  _ring.push({ ts: iso, level, tag, guildId: guildId ?? null, msg });
  if (_ring.length > RING_SIZE) _ring.shift();

  // 3. Datadog batch queue
  if (DD_ENABLED) {
    _ddQueue.push({
      ddsource:  'nodejs',
      ddtags:    `env:${DD_ENV},tag:${tag}${guildId ? `,guild:${guildId}` : ''}`,
      service:   DD_SERVICE,
      hostname:  process.env.HOSTNAME ?? 'bot',
      level,
      tag,
      guild_id:  guildId ?? null,
      message:   msg,
      timestamp: iso,
    });
    if (_ddQueue.length >= DD_BATCH_MAX) _flushToDatadog();
    else _scheduleDDFlush();
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
module.exports = {
  debug: (tag, guildId, ...args) => log('debug', tag, guildId, ...args),
  info:  (tag, guildId, ...args) => log('info',  tag, guildId, ...args),
  warn:  (tag, guildId, ...args) => log('warn',  tag, guildId, ...args),
  error: (tag, guildId, ...args) => log('error', tag, guildId, ...args),

  /**
   * getRing — lấy entries từ ring buffer.
   * @param {object} opts
   * @param {string}  [opts.level]   — filter by level
   * @param {string}  [opts.tag]     — filter by tag (startsWith)
   * @param {string}  [opts.guildId] — filter by guildId
   * @param {number}  [opts.limit]   — số dòng trả về (default 50)
   * @returns {Array<{ts,level,tag,guildId,msg}>}
   */
  getRing({ level, tag, guildId, limit = 50 } = {}) {
    let entries = [..._ring];
    if (level)   entries = entries.filter(e => e.level   === level);
    if (tag)     entries = entries.filter(e => e.tag.startsWith(tag.toUpperCase()));
    if (guildId) entries = entries.filter(e => e.guildId === guildId);
    return entries.slice(-limit);
  },

  /** flush thủ công sang Datadog ngay (dùng cho test/debug) */
  flush: _flushToDatadog,

  /** trạng thái Datadog */
  ddStatus: () => ({
    enabled:   DD_ENABLED,
    site:      DD_SITE,
    service:   DD_SERVICE,
    env:       DD_ENV,
    queueSize: _ddQueue.length,
    ringSize:  _ring.length,
  }),
};
