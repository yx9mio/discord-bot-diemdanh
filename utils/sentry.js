// utils/sentry.js
// [D1] Sentry helper — không log PII (chỉ log lỗi + breadcrumb kỹ thuật)
'use strict';

let _Sentry = null;
let _initialized = false;

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

/**
 * Khởi tạo Sentry. Gọi 1 lần duy nhất ở startup (index.js).
 * Nếu thiếu SENTRY_DSN thì no-op an toàn.
 */
function initSentry() {
  if (_initialized) return;
  _initialized = true;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  const Sentry = _load();
  if (!Sentry) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'production',
    release: `discord-bot-diemdanh@${process.env.npm_package_version ?? 'dev'}`,
    tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE
      ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE)
      : 0.0,
    // Chỉ capture exception + breadcrumb — không gửi dữ liệu nhạy cảm
    beforeSend(event) {
      if (event.request?.data) event.request.data = undefined;
      return event;
    },
  });
}

/**
 * Gửi error lên Sentry.
 * @param {Error|unknown} error
 * @param {string} [module]
 * @param {Record<string, unknown>} [extra]
 */
function captureError(error, module, extra = {}) {
  const Sentry = _Sentry ?? _load();
  if (!Sentry) return;
  const err = error instanceof Error ? error : new Error(String(error ?? 'Unknown error'));
  Sentry.withScope((scope) => {
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
  if (!Sentry) return;
  Sentry.withScope((scope) => {
    scope.setLevel(level);
    scope.setTag('module', module ?? 'unknown');
    Sentry.captureMessage(message);
  });
}

/**
 * @param {string} category
 * @param {string} message
 * @param {Record<string, unknown>} [data]
 */
function addBreadcrumb(category, message, data = {}) {
  const Sentry = _Sentry ?? _load();
  if (!Sentry) return;
  Sentry.addBreadcrumb({ category, message, data, level: 'info' });
}

module.exports = { initSentry, captureError, captureMessage, addBreadcrumb };
