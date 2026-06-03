// utils/sentry.js
// [D1] Sentry breadcrumb helper — không log PII
'use strict';

let _Sentry = null;

function getSentry() {
  if (!process.env.SENTRY_DSN) return null;
  if (!_Sentry) {
    try {
      _Sentry = require('@sentry/node');
    } catch {
      return null;
    }
  }
  return _Sentry;
}

/**
 * @param {string} category
 * @param {string} message
 * @param {Record<string, unknown>} [data]
 */
function addBreadcrumb(category, message, data = {}) {
  const Sentry = getSentry();
  if (!Sentry) return;
  Sentry.addBreadcrumb({ category, message, data, level: 'info' });
}

module.exports = { addBreadcrumb };
