'use strict';
const { test } = require('../testRunner.js');

/**
 * Suite 8 — Unit test pure functions (zero DB, zero Discord API)
 *
 * Test các functions thực tế export từ:
 *   - utils/helpers.js  : layHuyHieu, formatThoiGian, laAdmin
 *   - utils/timeCalc.js : msToNextWeekday, msFromOpenToClose, msToCloseFromNow
 */
async function helpersSuite(_guildId) {
  let helpers, timeCalc;

  try {
    helpers  = require('../../utils/helpers.js');
    timeCalc = require('../../utils/timeCalc.js');
  } catch (err) {
    return [{ name: '[FATAL] load utils', passed: false, error: err.message, durationMs: 0 }];
  }

  const { layHuyHieu, formatThoiGian, laAdmin } = helpers;
  const { msToNextWeekday, msFromOpenToClose, msToCloseFromNow } = timeCalc;

  return Promise.all([
    // ─── helpers.js ────────────────────────────────────────────
    test('layHuyHieu(0) → chuỗi rỗng (chưa đủ mốc)', async () => {
      if (typeof layHuyHieu !== 'function') throw new Error('layHuyHieu không export');
      const r = layHuyHieu(0);
      if (r !== '') throw new Error(`kết quả: "${r}"`);
    }),

    test('layHuyHieu(5) → có 🌱 Lính Mới', async () => {
      if (typeof layHuyHieu !== 'function') throw new Error('layHuyHieu không export');
      const r = layHuyHieu(5);
      if (!r.includes('🌱')) throw new Error(`thiếu 🌱: "${r}"`);
    }),

    test('layHuyHieu(100) → có 👑 Vua Điểm Danh', async () => {
      if (typeof layHuyHieu !== 'function') throw new Error('layHuyHieu không export');
      const r = layHuyHieu(100);
      if (!r.includes('👑')) throw new Error(`thiếu 👑: "${r}"`);
    }),

    test('formatThoiGian(3600000) → "1 giờ"', async () => {
      if (typeof formatThoiGian !== 'function') throw new Error('formatThoiGian không export');
      const r = formatThoiGian(3600000);
      if (!r.includes('1') || !r.includes('giờ')) throw new Error(`kết quả: "${r}"`);
    }),

    test('formatThoiGian(120000) → "2 phút"', async () => {
      if (typeof formatThoiGian !== 'function') throw new Error('formatThoiGian không export');
      const r = formatThoiGian(120000);
      if (!r.includes('phút')) throw new Error(`kết quả: "${r}"`);
    }),

    test('laAdmin(null, {}) → false (không throw)', async () => {
      if (typeof laAdmin !== 'function') throw new Error('laAdmin không export');
      const r = laAdmin(null, {});
      if (r !== false) throw new Error(`kết quả: ${r}`);
    }),

    // ─── timeCalc.js ────────────────────────────────────────
    test('msToNextWeekday trả về số dương', async () => {
      if (typeof msToNextWeekday !== 'function') throw new Error('msToNextWeekday không export');
      const ms = msToNextWeekday(6, 21, 0); // T7 21:00
      if (typeof ms !== 'number') throw new Error(`không phải number: ${typeof ms}`);
      if (ms <= 0) throw new Error(`ms không dương: ${ms}`);
      if (ms > 7 * 24 * 3600 * 1000) throw new Error(`ms > 7 ngày: ${ms}`);
    }),

    test('msFromOpenToClose (CN 21:00 → CN 23:30) → 9000000ms', async () => {
      if (typeof msFromOpenToClose !== 'function') throw new Error('msFromOpenToClose không export');
      const ms = msFromOpenToClose(0, 21, 0, 0, 23, 30);
      const expected = (23 * 60 + 30 - 21 * 60) * 60 * 1000; // 9000000
      if (ms !== expected) throw new Error(`kết quả: ${ms}, expected: ${expected}`);
    }),

    test('msFromOpenToClose qua nửa đêm (T7 23:00 → CN 01:00)', async () => {
      if (typeof msFromOpenToClose !== 'function') throw new Error('msFromOpenToClose không export');
      const ms = msFromOpenToClose(6, 23, 0, 0, 1, 0);
      const expected = 2 * 60 * 60 * 1000; // 7200000ms = 2 tiếng
      if (ms !== expected) throw new Error(`kết quả: ${ms}, expected: ${expected}`);
    }),

    test('msToCloseFromNow trả về number (không throw)', async () => {
      if (typeof msToCloseFromNow !== 'function') throw new Error('msToCloseFromNow không export');
      // Session mở 1 giờ trước, đóng sau 2 tiếng → còn ~1 tiếng
      const createdAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const ms = msToCloseFromNow(0, 0, 0, 0, 2, 0, createdAt);
      if (typeof ms !== 'number') throw new Error(`không phải number: ${typeof ms}`);
    }),
  ]);
}

module.exports = helpersSuite;
