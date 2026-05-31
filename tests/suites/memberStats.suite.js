'use strict';
const db = require('../../db.js');
const { test } = require('../testRunner.js');
const { FAKE_USER_ID, FAKE_USER_ID_2 } = require('../testConstants.js');

/**
 * Suite 4 — Member Stats CRUD
 * AN TOÀN: chỉ dùng FAKE_USER_ID / FAKE_USER_ID_2 — không thể là Discord user thật
 * Cleanup: DELETE rows fake trong finally
 */
async function memberStatsSuite(guildId) {
  const results = [];

  try {
    results.push(await test('upsertMemberStats (tạo mới)', async () => {
      await db.upsertMemberStats(guildId, FAKE_USER_ID, {
        total_sessions: 1,
        total_joined: 1,
        current_streak: 1,
        best_streak: 1,
      });
    }));

    results.push(await test('getMemberStats đọc lại đúng', async () => {
      const row = await db.getMemberStats(guildId, FAKE_USER_ID);
      if (!row) throw new Error('không tìm thấy row');
      if (row.total_sessions !== 1) throw new Error(`total_sessions sai: ${row.total_sessions}`);
    }));

    results.push(await test('batchUpsertMemberStats (user 2)', async () => {
      await db.batchUpsertMemberStats(guildId, [{
        user_id: FAKE_USER_ID_2,
        total_sessions: 2,
        total_joined: 2,
        current_streak: 2,
        best_streak: 2,
      }]);
    }));

    results.push(await test('resetMemberStreak về 0', async () => {
      await db.resetMemberStreak(guildId, FAKE_USER_ID);
    }));

    results.push(await test('verify streak = 0 sau reset', async () => {
      const row = await db.getMemberStats(guildId, FAKE_USER_ID);
      if (!row) throw new Error('không tìm thấy');
      if (row.current_streak !== 0) throw new Error(`current_streak vẫn là ${row.current_streak}`);
    }));
  } finally {
    // Xóa sạch 2 fake users khỏi member_stats
    try {
      await db.supabase.from('member_stats')
        .delete()
        .eq('guild_id', guildId)
        .in('user_id', [FAKE_USER_ID, FAKE_USER_ID_2]);
    } catch (_) { /* ignore */ }
  }

  return results;
}

module.exports = memberStatsSuite;
