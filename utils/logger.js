// utils/logger.js — Structured logger + Grafana Loki transport (free)
// Usage:
//   const log = require('./utils/logger.js');
//   log.info('SCHEDULER', guildId, 'Đã mở phiên "%s"', session_name);
//   log.warn('READY',     null,    'Không xóa được commands: %s', err.message);
//   log.error('CMD',      guildId, 'Lỗi lệnh /batdau: %s', err.stack);
//   log.debug('DB',       guildId, 'query: %s', sql);
//
// ENV:
//   LOG_LEVEL          — debug | info | warn | error  (default: info)
//
//   --- Grafana Cloud Loki (miễn phí 50GB/tháng) ---
//   LOKI_URL           — https://logs-prod-xxx.grafana.net  (bỏ trống để tắt)
//   LOKI_USER          — Grafana Cloud numeric user ID
//   LOKI_TOKEN         — Grafana Cloud API token (glc_xxx...)
//   LOKI_SERVICE       — tên service  (default: discord-bot-diemdanh)
//   LOKI_ENV           — môi trường   (default: production)
//   LOKI_FLUSH_INTERVAL— ms giữa các batch flush (default: 5000)
//   LOKI_BATCH_MAX     — số log tối đa mỗi batch  (default: 100)
//
// Self-host Loki (không cần LOKI_USER/LOKI_TOKEN, chỉ cần LOKI_URL):
//   LOKI_URL=http://localhost:3100
'use strict';

const https = require('https');
const http  = require('http');

const LEVEL_RANK = { debug: 0, info: 1, warn: 2, error: 3 };

const _envLevel = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
const MIN_RANK  = LEVEL_RANK[_envLevel] ?? LEVEL_RANK.info;

// ─── Loki config ───────────────────────────────────────────────────────────────
const LOKI_URL            = (process.env.LOKI_URL ?? '').replace(/\/$/, '');
const LOKI_USER           = process.env.LOKI_USER   ?? '';
const LOKI_TOKEN          = process.env.LOKI_TOKEN  ?? '';
const LOKI_SERVICE        = process.env.LOKI_SERVICE ?? 'discord-bot-diemdanh';
const LOKI_ENV            = process.env.LOKI_ENV    ?? 'production';
const LOKI_FLUSH_INTERVAL = parseInt(process.env.LOKI_FLUSH_INTERVAL ?? '5000', 10);
const LOKI_BATCH_MAX      = parseInt(process.env.LOKI_BATCH_MAX      ?? '100',  10);
const LOKI_ENABLED        = LOKI_URL.length > 0;

// Basic auth header (Grafana Cloud yêu cầu; self-host bỏ trống)
const _lokiAuth = LOKI_USER && LOKI_TOKEN
  ? 'Basic ' + Buffer.from(`${LOKI_USER}:${LOKI_TOKEN}`).toString('base64')
  : null;

// Phân tích LOKI_URL — hỗ trợ cả http và https
let _lokiParsed = null;
if (LOKI_ENABLED) {
  try { _lokiParsed = new URL(LOKI_URL + '/loki/api/v1/push'); }
  catch { process.stderr.write('[LOGGER] LOKI_URL không hợp lệ, tắt Loki transport.\n'); }
}

// ─── In-memory ring buffer cho /log command (max 500 entries) ──────────────
const RING_SIZE = 500;
const _ring = [];

// ─── Loki batch queue ───────────────────────────────────────────────────────
let _lokiQueue = []; // [{ts_ns, line, labels}]
let _lokiTimer = null;

function _scheduleLokiFlush() {
  if (_lokiTimer) return;
  _lokiTimer = setTimeout(() => {
    _lokiTimer = null;
    _flushToLoki();
  }, LOKI_FLUSH_INTERVAL);
}

/**
 * Loki push API payload format:
 * {
 *   "streams": [{
 *     "stream": { "service": "...", "level": "...", "tag": "..." },
 *     "values": [["<unix_epoch_nanoseconds>", "<log line>"]]
 *   }]
 * }
 * Mỗi stream = 1 tập nhãn, gộp các entries cùng nhãn vào chung.
 */
function _flushToLoki() {
  if (!LOKI_ENABLED || !_lokiParsed || _lokiQueue.length === 0) return;

  const batch = _lokiQueue.splice(0, LOKI_BATCH_MAX);

  // Group by label key (service+env+level+tag)
  const streamMap = new Map();
  for (const entry of batch) {
    const key = entry.labelKey;
    if (!streamMap.has(key)) streamMap.set(key, { labels: entry.labels, values: [] });
    streamMap.get(key).values.push([entry.ts_ns, entry.line]);
  }

  const payload = JSON.stringify({
    streams: [...streamMap.values()].map(s => ({
      stream: s.labels,
      values: s.values,
    })),
  });

  const headers = {
    'Content-Type':   'application/json',
    'Content-Length': Buffer.byteLength(payload),
  };
  if (_lokiAuth) headers['Authorization'] = _lokiAuth;

  const transport = _lokiParsed.protocol === 'https:' ? https : http;
  const req = transport.request(
    {
      hostname: _lokiParsed.hostname,
      port:     _lokiParsed.port || (_lokiParsed.protocol === 'https:' ? 443 : 80),
      path:     _lokiParsed.pathname,
      method:   'POST',
      headers,
    },
    (res) => {
      if (res.statusCode >= 400) {
        let body = '';
        res.on('data', c => { body += c; });
        res.on('end',  () => {
          process.stderr.write(`[LOGGER] Loki flush HTTP ${res.statusCode}: ${body.slice(0, 200)}\n`);
        });
      } else {
        res.resume();
      }
    },
  );
  req.on('error', (e) => {
    process.stderr.write(`[LOGGER] Loki flush error: ${e.message}\n`);
    // retry: đẩy lại vào đầu queue
    _lokiQueue.unshift(...batch);
  });
  req.write(payload);
  req.end();

  if (_lokiQueue.length > 0) _scheduleLokiFlush();
}

// Flush khi process thoát
process.on('exit',    () => _flushToLoki());
process.on('SIGINT',  () => { _flushToLoki(); process.exit(0); });
process.on('SIGTERM', () => { _flushToLoki(); process.exit(0); });

// ─── ANSI console ───────────────────────────────────────────────────────────────
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

// ─── Core log fn ────────────────────────────────────────────────────────────
function log(level, tag, guildId, ...args) {
  if ((LEVEL_RANK[level] ?? 0) < MIN_RANK) return;

  const msg = _resolveMsg(args);
  const iso = new Date().toISOString();

  // 1. stdout / stderr (giữ nguyên như cũ)
  const line = _buildLine(level, tag, guildId, msg);
  if (level === 'error') process.stderr.write(line + '\n');
  else                   process.stdout.write(line + '\n');

  // 2. In-memory ring buffer
  _ring.push({ ts: iso, level, tag, guildId: guildId ?? null, msg });
  if (_ring.length > RING_SIZE) _ring.shift();

  // 3. Loki batch queue
  if (LOKI_ENABLED && _lokiParsed) {
    // Loki yêu cầu timestamp dạng nanoseconds string
    const ts_ns  = (BigInt(new Date(iso).getTime()) * 1_000_000n).toString();
    const labels = {
      service:  LOKI_SERVICE,
      env:      LOKI_ENV,
      level,
      tag,
      ...(guildId ? { guild_id: guildId } : {}),
    };
    // Key để group streams
    const labelKey = `${level}|${tag}|${guildId ?? ''}`;
    // Log line: JSON structured cho Grafana query dễ
    const logLine = JSON.stringify({
      ts:       iso,
      level,
      tag,
      guild_id: guildId ?? null,
      msg,
    });
    _lokiQueue.push({ ts_ns, line: logLine, labels, labelKey });
    if (_lokiQueue.length >= LOKI_BATCH_MAX) _flushToLoki();
    else _scheduleLokiFlush();
  }
}

// ─── Public API ────────────────────────────────────────────────────────────
module.exports = {
  debug: (tag, guildId, ...args) => log('debug', tag, guildId, ...args),
  info:  (tag, guildId, ...args) => log('info',  tag, guildId, ...args),
  warn:  (tag, guildId, ...args) => log('warn',  tag, guildId, ...args),
  error: (tag, guildId, ...args) => log('error', tag, guildId, ...args),

  /**
   * getRing — lấy entries từ ring buffer.
   * @param {{ level?, tag?, guildId?, limit? }} opts
   */
  getRing({ level, tag, guildId, limit = 50 } = {}) {
    let entries = [..._ring];
    if (level)   entries = entries.filter(e => e.level   === level);
    if (tag)     entries = entries.filter(e => e.tag.startsWith(tag.toUpperCase()));
    if (guildId) entries = entries.filter(e => e.guildId === guildId);
    return entries.slice(-limit);
  },

  /** Flush thủ công sang Loki ngay */
  flush: _flushToLoki,

  /** Trạng thái Loki transport (dùng cho /log command) */
  lokiStatus: () => ({
    enabled:   LOKI_ENABLED && !!_lokiParsed,
    url:       LOKI_URL || null,
    service:   LOKI_SERVICE,
    env:       LOKI_ENV,
    auth:      !!(LOKI_USER && LOKI_TOKEN),
    queueSize: _lokiQueue.length,
    ringSize:  _ring.length,
  }),

  // Alias giữ tương thích với commands/log.js (ddStatus → lokiStatus)
  ddStatus: () => {
    const s = module.exports.lokiStatus();
    return {
      enabled:   s.enabled,
      site:      s.url ? new URL(s.url).hostname : '—',
      service:   s.service,
      env:       s.env,
      queueSize: s.queueSize,
      ringSize:  s.ringSize,
    };
  },
};
