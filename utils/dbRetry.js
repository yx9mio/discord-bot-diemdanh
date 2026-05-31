// utils/dbRetry.js — L-1: Tự động retry khi Supabase trả về lỗi tạm thời
'use strict';
const log = require('./logger.js');

// Lỗi tạm thời → retry; lỗi logic → throw ngay
const RETRYABLE = [
  'FetchError', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND',
  'socket hang up', '503', '504', 'upstream',
];

function isRetryable(err) {
  const msg = (err?.message || err?.code || '').toLowerCase();
  return RETRYABLE.some(k => msg.includes(k.toLowerCase()));
}

/**
 * Thực thi fn() với exponential back-off.
 * @param {() => Promise<any>} fn     Hàm DB cần retry
 * @param {object}             opts
 * @param {number}  opts.maxAttempts  Tối đa số lần thử (default 3)
 * @param {number}  opts.baseMs       Delay cơ sở ms (default 400)
 * @param {string}  opts.label        Tên fn để log
 */
async function dbRetry(fn, { maxAttempts = 3, baseMs = 400, label = 'db' } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === maxAttempts) throw err;
      const delay = baseMs * 2 ** (attempt - 1) + Math.random() * 100;
      log.warn('DB', null, '[%s] Retry %s/%s sau %sms — %s', label, attempt, maxAttempts - 1, Math.round(delay), err.message);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

module.exports = { dbRetry };
