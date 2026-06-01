'use strict';
const db = require('../../db.js');
const { test } = require('../testRunner.js');

/**
 * Suite 1 — DB Connectivity (read-only, không ghi gì)
 */
async function dbSuite(guildId) {
  return Promise.all([
    test('SELECT 1 ping', async () => {
      const { error } = await db.supabase.rpc('version');
      // rpc('version') = SELECT version() — nếu kết nối chết sẽ throw
      if (error && error.code !== 'PGRST202') throw error; // PGRST202 = function not found → vẫn connected
    }),
    test('getConfig không throw', async () => {
      const cfg = await db.getConfig(guildId);
      // null là hợp lệ (guild chưa setup), chỉ cần không throw
      if (cfg !== null && typeof cfg !== 'object') throw new Error('unexpected type');
    }),
    test('getActiveSession trả về null hoặc object', async () => {
      const s = await db.getActiveSession(guildId);
      if (s !== null && typeof s !== 'object') throw new Error('unexpected type');
    }),
    test('getTopMembers trả về array', async () => {
      const rows = await db.getTopMembers(guildId, 5);
      if (!Array.isArray(rows)) throw new Error('not array');
    }),
    test('getSessionHistory trả về array', async () => {
      const rows = await db.getSessionHistory(guildId, 5);
      if (!Array.isArray(rows)) throw new Error('not array');
    }),
    test('getScheduledSessions trả về array', async () => {
      const rows = await db.getScheduledSessions(guildId);
      if (!Array.isArray(rows)) throw new Error('not array');
    }),
    test('getBadges trả về array', async () => {
      const rows = await db.getBadges(guildId);
      if (!Array.isArray(rows)) throw new Error('not array');
    }),
    test('getAllMemberStats trả về array', async () => {
      const rows = await db.getAllMemberStats(guildId);
      if (!Array.isArray(rows)) throw new Error('not array');
    }),
  ]);
}

module.exports = dbSuite;
