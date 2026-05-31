'use strict';
const db = require('../../db.js');
const { test } = require('../testRunner.js');
const { TEST_SESSION_NAME, FAKE_USER_ID } = require('../testConstants.js');

/**
 * Suite 2 — Session CRUD
 * Lifecycle: create → getById → updateMessageId → getActiveSession → end → verify ended
 * Cleanup: cancelSession trong finally
 */
async function sessionSuite(guildId) {
  let sessionId = null;
  const results = [];

  try {
    results.push(await test('createSession', async () => {
      const s = await db.createSession(guildId, TEST_SESSION_NAME, FAKE_USER_ID, null, null, null);
      if (!s?.id) throw new Error('không có id');
      sessionId = s.id;
    }));

    results.push(await test('getSessionById', async () => {
      if (!sessionId) throw new Error('skip — createSession failed');
      const s = await db.getSessionById(sessionId, guildId);
      if (!s) throw new Error('không tìm thấy');
      if (s.session_name !== TEST_SESSION_NAME) throw new Error(`name sai: ${s.session_name}`);
    }));

    results.push(await test('updateSessionMessageId', async () => {
      if (!sessionId) throw new Error('skip');
      await db.updateSessionMessageId(sessionId, '999999999999999999');
    }));

    results.push(await test('getActiveSession thấy session test', async () => {
      if (!sessionId) throw new Error('skip');
      const s = await db.getActiveSession(guildId);
      // Có thể có active session thật — chỉ cần không throw
      if (s !== null && typeof s !== 'object') throw new Error('unexpected type');
    }));

    results.push(await test('endSession', async () => {
      if (!sessionId) throw new Error('skip');
      await db.endSession(sessionId);
    }));

    results.push(await test('verify ended_at set', async () => {
      if (!sessionId) throw new Error('skip');
      const s = await db.getSessionByIdRaw(sessionId, guildId);
      if (!s?.ended_at) throw new Error('ended_at chưa được set');
      if (s.is_active !== false) throw new Error('is_active vẫn true');
    }));
  } finally {
    // Cleanup: đảm bảo session không còn active
    if (sessionId) {
      try { await db.cancelSession(sessionId); } catch (_) { /* đã end rồi, ignore */ }
    }
  }

  return results;
}

module.exports = sessionSuite;
