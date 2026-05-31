'use strict';
const db = require('../../db.js');
const { test } = require('../testRunner.js');
const { TEST_SESSION_NAME, FAKE_USER_ID } = require('../testConstants.js');

/**
 * Suite 3 — Attendance flow
 * Dùng FAKE_USER_ID — không phải user Discord thật
 * Cleanup: cancelSession (không ảnh hưởng member_stats)
 */
async function attendanceSuite(guildId) {
  let sessionId = null;
  const results = [];

  try {
    results.push(await test('createSession nền', async () => {
      const s = await db.createSession(guildId, TEST_SESSION_NAME + '_att', FAKE_USER_ID, null, null, null);
      if (!s?.id) throw new Error('không có id');
      sessionId = s.id;
    }));

    results.push(await test('upsertAttendance (join)', async () => {
      if (!sessionId) throw new Error('skip');
      await db.upsertAttendance(sessionId, guildId, FAKE_USER_ID, '__test_user__', 'present', null);
    }));

    results.push(await test('getAttendance tìm thấy record', async () => {
      if (!sessionId) throw new Error('skip');
      const row = await db.getAttendance(sessionId, FAKE_USER_ID);
      if (!row) throw new Error('không tìm thấy row');
      if (row.status !== 'present') throw new Error(`status sai: ${row.status}`);
    }));

    results.push(await test('getAttendances trả về list có user', async () => {
      if (!sessionId) throw new Error('skip');
      const rows = await db.getAttendances(sessionId);
      if (!Array.isArray(rows)) throw new Error('not array');
      const found = rows.find(r => r.user_id === FAKE_USER_ID);
      if (!found) throw new Error('FAKE_USER_ID không có trong list');
    }));

    results.push(await test('upsertAttendanceNoTime (update status)', async () => {
      if (!sessionId) throw new Error('skip');
      await db.upsertAttendanceNoTime(sessionId, guildId, FAKE_USER_ID, '__test_user__', 'absent', null);
    }));

    results.push(await test('getAttendanceSummaryForSessions', async () => {
      if (!sessionId) throw new Error('skip');
      const map = await db.getAttendanceSummaryForSessions([sessionId]);
      if (!(map instanceof Map)) throw new Error('không phải Map');
      const rows = map.get(sessionId) ?? [];
      if (!rows.find(r => r.user_id === FAKE_USER_ID)) throw new Error('FAKE_USER_ID không có trong summary');
    }));

    results.push(await test('endSession (cleanup session nền)', async () => {
      if (!sessionId) throw new Error('skip');
      await db.endSession(sessionId);
    }));
  } finally {
    if (sessionId) {
      try {
        // Xóa attendance của FAKE_USER_ID
        await db.supabase.from('attendances')
          .delete().eq('session_id', sessionId).eq('user_id', FAKE_USER_ID);
        // Đảm bảo session đóng
        await db.cancelSession(sessionId);
      } catch (_) { /* ignore */ }
    }
  }

  return results;
}

module.exports = attendanceSuite;
