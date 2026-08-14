// utils/sentry.js — Deep Sentry integration cho bot.
// Policy: KHÔNG gửi PII. Chỉ gửi snowflake IDs (guild/user/channel/session), module, tags.
// Env:
//   SENTRY_DSN                    (bắt buộc để bật Sentry)
//   SENTRY_ENVIRONMENT            (mặc định = NODE_ENV ?? 'production')
//   SENTRY_TRACES_SAMPLE_RATE     (mặc định 0.1)
//   SENTRY_PROFILES_SAMPLE_RATE   (mặc định 0.05, cần @sentry/profiling-node)
//   SENTRY_ANR_THRESHOLD_MS       (mặc định 10000, 0 = tắt ANR)
'use strict';

let _Sentry = null;
let _ready = false;

function _load() {
  if (!_Sentry) {
    try {
      _Sentry = require('@sentry/node');
    } catch {
      _Sentry = null;
    }
  }
  return _Sentry;
}

function _num(env, fallback) {
  const v = process.env[env];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function _enabled() {
  return _ready;
}

/**
 * Khởi tạo Sentry. Gọi 1 lần duy nhất ở startup (index.js).
 * Nếu thiếu SENTRY_DSN thì no-op an toàn.
 */
function initSentry() {
  if (_ready) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  const Sentry = _load();
  if (!Sentry) return;

  const integrations = [
    Sentry.httpIntegration(),
    Sentry.extraErrorDataIntegration(),
    Sentry.localVariablesIntegration(),
    Sentry.onUnhandledRejectionIntegration(),
    Sentry.onUncaughtExceptionIntegration(),
    Sentry.nodeRuntimeMetricsIntegration({ collectionIntervalMs: 60_000 }),
  ];

  // Span cho truy vấn Supabase (PostgREST qua HTTP). Lazy require tránh vòng lặp.
  try {
    const { getClient } = require('../services/_client.js');
    integrations.push(Sentry.supabaseIntegration({ supabaseClient: getClient() }));
  } catch { /* chưa config Supabase — bỏ qua */ }

  // Pino logs → breadcrumbs (SDK logs). Tắt elevation error để tránh trùng với captureError.
  try {
    integrations.push(Sentry.pinoIntegration({ error: { levels: [] } }));
  } catch { /* không có pinoIntegration — bỏ qua */ }

  // Profiling (optional — cần @sentry/profiling-node)
  let hasProfiling = false;
  try {
    const { nodeProfilingIntegration } = require('@sentry/profiling-node');
    integrations.push(nodeProfilingIntegration());
    hasProfiling = true;
  } catch { /* chưa cài profiling-node — bỏ qua */ }

  const anrThreshold = _num('SENTRY_ANR_THRESHOLD_MS', 10_000);
  if (anrThreshold > 0) {
    integrations.push(Sentry.anrIntegration({ thresholdMs: anrThreshold }));
  }

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'production',
    release: `discord-bot-diemdanh@${process.env.npm_package_version ?? 'dev'}`,
    serverName: false,
    enableLogs: true,
    integrations: (current) => [...current, ...integrations],
    tracesSampleRate: _num('SENTRY_TRACES_SAMPLE_RATE', 0.1),
    profilesSampleRate: hasProfiling ? _num('SENTRY_PROFILES_SAMPLE_RATE', 0.05) : undefined,
    attachStacktrace: true,
    maxBreadcrumbs: 100,
    sendDefaultPii: false,
    ignoreTransactions: ['/health', '/'],
    beforeSend(event) {
      // Xoá dữ liệu nhạy cảm khỏi request (body/headers không cần thiết)
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers.Authorization;
          delete event.request.headers.authorization;
          delete event.request.headers.Cookie;
          delete event.request.headers.cookie;
          delete event.request.headers['x-api-key'];
        }
      }
      return event;
    },
    beforeSendTransaction(event) {
      if (event.request?.url?.includes('/health')) return null;
      return event;
    },
  });
  _ready = true;
}

/**
 * Gắn context lên isolation scope hiện tại (guild/user/channel/session).
 * Chỉ gửi snowflake IDs — không gửi username, avatar, nội dung message.
 * @param {object} ctx
 */
function setContext(ctx = {}) {
  const Sentry = _Sentry ?? _load();
  if (!Sentry || !_enabled()) return;
  Sentry.withIsolationScope((scope) => {
    const gid = ctx.guildId ?? ctx.interaction?.guild?.id ?? ctx.interaction?.guildId;
    const uid = ctx.userId ?? ctx.interaction?.user?.id ?? ctx.interaction?.member?.id;
    const cid = ctx.channelId ?? ctx.interaction?.channelId ?? ctx.interaction?.channel?.id;
    if (gid) scope.setTag('guild_id', gid);
    if (uid) scope.setUser({ id: uid });
    if (cid) scope.setTag('channel_id', cid);
    if (ctx.sessionId) scope.setTag('session_id', ctx.sessionId);
    if (ctx.handler) scope.setTag('handler', ctx.handler);
    if (ctx.command) scope.setTag('command', ctx.command);
    if (ctx.interaction?.id) scope.setTag('interaction_id', ctx.interaction.id);
  });
}

/**
 * Chạy fn bên trong một transaction span có sẵn context (guild/user/channel/handler).
 * Dùng cho interaction handlers (buttons/selects/modals) qua wrapHandler.
 * @param {{interaction?: object, handler?: string, command?: string, op?: string}} opts
 * @param {Function} fn  — async/sync, kết quả được await
 */
function withInteractionSpan(opts, fn) {
  const Sentry = _Sentry ?? _load();
  if (!Sentry || !_enabled()) return fn();
  const interaction = opts?.interaction;
  const name = opts?.command ?? opts?.handler ?? 'interaction';
  const op = opts?.op ?? 'interaction.handler';

  return Sentry.withIsolationScope(() => {
    setContext({ interaction, handler: opts?.handler, command: opts?.command });
    return Sentry.startSpan({ op, name }, () => fn());
  });
}

/**
 * Gửi error lên Sentry.
 * @param {Error|unknown} error
 * @param {string} [module]
 * @param {Record<string, unknown>} [extra] — có thể kèm guildId/userId/sessionId/handler
 */
function captureError(error, module, extra = {}) {
  const Sentry = _Sentry ?? _load();
  if (!Sentry || !_enabled()) return;
  const err = error instanceof Error ? error : new Error(String(error ?? 'Unknown error'));
  Sentry.withScope((scope) => {
    const gid = extra.guildId;
    const uid = extra.userId;
    if (gid) scope.setTag('guild_id', gid);
    if (uid) scope.setUser({ id: uid });
    if (extra.sessionId) scope.setTag('session_id', extra.sessionId);
    if (extra.handler) scope.setTag('handler', extra.handler);
    scope.setTag('module', module ?? 'unknown');
    scope.setExtra('extra', extra);
    Sentry.captureException(err);
  });
}

/**
 * Gửi message (warning/error) lên Sentry.
 * @param {string} message
 * @param {string} [module]
 * @param {'error'|'warning'|'info'} [level]
 */
function captureMessage(message, module, level = 'error') {
  const Sentry = _Sentry ?? _load();
  if (!Sentry || !_enabled()) return;
  Sentry.withScope((scope) => {
    scope.setLevel(level);
    scope.setTag('module', module ?? 'unknown');
    Sentry.captureMessage(message);
  });
}

/**
 * Thêm breadcrumb vào scope hiện tại.
 * @param {string} category
 * @param {string} message
 * @param {Record<string, unknown>} [data]
 */
function addBreadcrumb(category, message, data = {}) {
  const Sentry = _Sentry ?? _load();
  if (!Sentry || !_enabled()) return;
  Sentry.addBreadcrumb({ category, message, data, level: 'info' });
}

/**
 * Cron/uptime monitor cho Sentry. Nếu chưa bật Sentry thì chạy fn bình thường.
 * @param {string} monitorSlug
 * @param {object} cfg — { schedule: { type: 'crontab', value }, timezone?, checkinMargin? }
 * @param {Function} fn
 */
function withCronMonitor(monitorSlug, cfg, fn) {
  const Sentry = _Sentry ?? _load();
  if (!Sentry || !_enabled()) return fn();
  return Sentry.withMonitor(monitorSlug, fn, cfg);
}

/**
 * Namespace metrics của Sentry (dùng cho utils/metrics.js). Trả null nếu tắt.
 */
function getMetricsNamespace() {
  const Sentry = _Sentry ?? _load();
  return Sentry && _enabled() ? Sentry.metrics : null;
}

/** Bật/tắt giám sát có sẵn không. */
function isEnabled() {
  return _enabled();
}

/**
 * Flush + close Sentry khi shutdown (gọi từ index.js trước process.exit).
 * @param {number} [timeoutMs]
 */
async function closeSentry(timeoutMs = 2000) {
  const Sentry = _Sentry ?? _load();
  if (!Sentry || !_enabled()) return;
  try {
    await Sentry.close(timeoutMs);
  } catch { /* ignore */ }
}

module.exports = {
  initSentry,
  setContext,
  withInteractionSpan,
  captureError,
  captureMessage,
  addBreadcrumb,
  withCronMonitor,
  getMetricsNamespace,
  isEnabled,
  closeSentry,
};
