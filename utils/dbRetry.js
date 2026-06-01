// utils/dbRetry.js — Tự động retry khi Supabase trả về lỗi tạm thời
// Dùng p-retry thay vì viết tay exponential backoff
'use strict';
const pRetry = require('p-retry');
const log    = require('./logger.js');

// Lỗi tạm thời → retry; lỗi logic → throw ngay
const RETRYABLE_KEYWORDS = [
  'FetchError', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND',
  'socket hang up', '503', '504', 'upstream',
];

function isRetryable(err) {
  const msg = (err?.message ?? err?.code ?? '').toLowerCase();
  return RETRYABLE_KEYWORDS.some(k => msg.includes(k.toLowerCase()));
}

/**
 * Thực thi fn() với exponential back-off (via p-retry).
 * @param {() => Promise<any>} fn
 * @param {{ maxAttempts?: number, baseMs?: number, label?: string }} opts
 */
function dbRetry(fn, { maxAttempts = 3, baseMs = 400, label = 'db' } = {}) {
  return pRetry(fn, {
    retries:    maxAttempts - 1,
    minTimeout: baseMs,
    factor:     2,
    randomize:  true,
    shouldRetry: (err) => {
      if (!isRetryable(err)) return false;
      log.warn('DB', null, '[%s] retrying — %s', label, err.message);
      return true;
    },
  });
}

module.exports = { dbRetry };
