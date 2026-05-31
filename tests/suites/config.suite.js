'use strict';
const db = require('../../db.js');
const { test } = require('../testRunner.js');
const { TEST_CONFIG_KEY } = require('../testConstants.js');

/**
 * Suite 7 — Config read/write/restore
 * AN TOÀN: backup config trước → write test field → verify → restore → verify restore
 * Không bao giờ mất dữ liệu config thật
 */
async function configSuite(guildId) {
  let backup = null;
  const results = [];

  // Backup config trước mọi thứ
  try {
    backup = await db.getConfig(guildId);
  } catch (err) {
    return [{ name: '[FATAL] getConfig backup', passed: false, error: err.message, durationMs: 0 }];
  }

  try {
    results.push(await test('getConfig đọc được (backup)', async () => {
      // Đã đọc ở trên, chỉ verify type
      if (backup !== null && typeof backup !== 'object') throw new Error('unexpected type');
    }));

    results.push(await test('upsertConfig ghi test field', async () => {
      await db.upsertConfig(guildId, { [TEST_CONFIG_KEY]: 'ping_test_value' });
    }));

    results.push(await test('verify test field tồn tại', async () => {
      const cfg = await db.getConfig(guildId);
      if (cfg?.[TEST_CONFIG_KEY] !== 'ping_test_value') {
        throw new Error(`field không đúng: ${cfg?.[TEST_CONFIG_KEY]}`);
      }
    }));

    results.push(await test('restore config về trạng thái ban đầu', async () => {
      // Nếu guild chưa có config row → upsert lại không có TEST_CONFIG_KEY
      const restorePayload = backup
        ? { ...backup }
        : { guild_id: guildId };
      // Loại bỏ test field
      delete restorePayload[TEST_CONFIG_KEY];
      await db.upsertConfig(guildId, restorePayload);

      // Verify: test field phải null/undefined
      const cfg = await db.getConfig(guildId);
      if (cfg?.[TEST_CONFIG_KEY] !== undefined && cfg?.[TEST_CONFIG_KEY] !== null) {
        throw new Error(`test field vẫn còn sau restore: ${cfg[TEST_CONFIG_KEY]}`);
      }
    }));
  } catch (err) {
    // Nếu có lỗi unexpected, vẫn cố restore
    if (backup) {
      try { await db.upsertConfig(guildId, backup); } catch (_) { /* ignore */ }
    }
    throw err;
  }

  return results;
}

module.exports = configSuite;
