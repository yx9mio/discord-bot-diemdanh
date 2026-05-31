'use strict';
const db = require('../../db.js');
const { test } = require('../testRunner.js');
const { TEST_SCHED_NAME } = require('../testConstants.js');

/**
 * Suite 5 — Scheduled Sessions CRUD
 * Cleanup: deleteScheduledSession trong finally
 */
async function scheduledSessionSuite(guildId) {
  let schedId = null;
  const results = [];

  try {
    results.push(await test('createScheduledSession', async () => {
      const s = await db.themLichCoDinh(guildId, {
        dayOfWeek: 0,         // Chủ Nhật
        hour: 3,
        minute: 0,
        sessionName: TEST_SCHED_NAME,
        closeDayOfWeek: 0,
        closeHour: 4,
        closeMinute: 0,
      });
      if (!s?.id) throw new Error('không có id');
      schedId = s.id;
    }));

    results.push(await test('getScheduledSessionById', async () => {
      if (!schedId) throw new Error('skip');
      const s = await db.getScheduledSessionById(schedId);
      if (!s) throw new Error('không tìm thấy');
      if (s.session_name !== TEST_SCHED_NAME) throw new Error(`name sai: ${s.session_name}`);
    }));

    results.push(await test('getScheduledSessions có chứa record', async () => {
      if (!schedId) throw new Error('skip');
      const rows = await db.getScheduledSessions(guildId);
      if (!Array.isArray(rows)) throw new Error('not array');
      const found = rows.find(r => r.id === schedId);
      if (!found) throw new Error('không tìm thấy trong list');
    }));

    results.push(await test('updateScheduledSession', async () => {
      if (!schedId) throw new Error('skip');
      await db.updateScheduledSession(schedId, { hour: 4, minute: 30 });
      const s = await db.getScheduledSessionById(schedId);
      if (s.hour !== 4) throw new Error(`hour không update: ${s.hour}`);
    }));

    results.push(await test('deleteScheduledSession', async () => {
      if (!schedId) throw new Error('skip');
      await db.deleteScheduledSession(schedId);
      const s = await db.getScheduledSessionById(schedId);
      if (s) throw new Error('vẫn còn tồn tại sau delete');
      schedId = null; // đánh dấu đã xóa, finally không cần cleanup
    }));
  } finally {
    if (schedId) {
      try { await db.deleteScheduledSession(schedId); } catch (_) { /* ignore */ }
    }
  }

  return results;
}

module.exports = scheduledSessionSuite;
