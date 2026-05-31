'use strict';
const { test } = require('../testRunner.js');

/**
 * Suite 8 — Unit test pure functions (zero DB, zero Discord API)
 * Test logic thuần của utils/helpers.js
 */
async function helpersSuite(_guildId) {
  let helpers;
  try {
    helpers = require('../../utils/helpers.js');
  } catch (err) {
    return [{ name: '[FATAL] load helpers.js', passed: false, error: err.message, durationMs: 0 }];
  }

  const { formatDongStr, ngayThucTe, pad } = helpers;

  return Promise.all([
    test('pad(5) → "05"', async () => {
      if (typeof pad !== 'function') throw new Error('pad không phải function');
      const r = pad(5);
      if (r !== '05') throw new Error(`kết quả: ${r}`);
    }),

    test('pad(12) → "12"', async () => {
      if (typeof pad !== 'function') throw new Error('pad không phải function');
      const r = pad(12);
      if (r !== '12') throw new Error(`kết quả: ${r}`);
    }),

    test('formatDongStr Thứ Bảy 21:00', async () => {
      if (typeof formatDongStr !== 'function') throw new Error('formatDongStr không export');
      const r = formatDongStr({ dayOfWeek: 6, hour: 21, minute: 0, closeHour: 23, closeMinute: 30, closeDayOfWeek: 6 });
      if (typeof r !== 'string') throw new Error('không trả về string');
      if (!r.includes('Thứ Bảy') && !r.includes('T7') && !r.includes('21')) {
        throw new Error(`output không có ngày giờ đúng: ${r}`);
      }
    }),

    test('ngayThucTe trả về Date hợp lệ', async () => {
      if (typeof ngayThucTe !== 'function') throw new Error('ngayThucTe không export');
      const d = ngayThucTe({ dayOfWeek: 1, hour: 9, minute: 0 });
      if (!(d instanceof Date) && typeof d !== 'string') throw new Error(`không trả về Date: ${typeof d}`);
    }),

    test('formatDongStr Chủ Nhật 00:00', async () => {
      if (typeof formatDongStr !== 'function') throw new Error('formatDongStr không export');
      const r = formatDongStr({ dayOfWeek: 0, hour: 0, minute: 0, closeHour: 1, closeMinute: 0, closeDayOfWeek: 0 });
      if (typeof r !== 'string') throw new Error('không trả về string');
    }),

    test('pad(0) → "00"', async () => {
      if (typeof pad !== 'function') throw new Error('pad không export');
      const r = pad(0);
      if (r !== '00') throw new Error(`kết quả: ${r}`);
    }),
  ]);
}

module.exports = helpersSuite;
