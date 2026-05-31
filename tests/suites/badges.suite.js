'use strict';
const db = require('../../db.js');
const { test } = require('../testRunner.js');
const { TEST_BADGE_THRESH, FAKE_USER_ID } = require('../testConstants.js');

/**
 * Suite 6 — Badges CRUD
 * Dùng threshold=9999 — không thể là badge thật
 * Cleanup: deleteBadge + xóa member_badge trong finally
 */
async function badgesSuite(guildId) {
  const results = [];
  let created = false;

  try {
    results.push(await test('upsertBadge (threshold 9999)', async () => {
      await db.upsertBadge(guildId, TEST_BADGE_THRESH, '🧪', '__TEST__ Badge');
      created = true;
    }));

    results.push(await test('getBadges thấy badge test', async () => {
      const rows = await db.getBadges(guildId);
      if (!Array.isArray(rows)) throw new Error('not array');
      const found = rows.find(r => r.threshold === TEST_BADGE_THRESH);
      if (!found) throw new Error('không tìm thấy badge test');
    }));

    results.push(await test('upsertMemberBadge (fake user)', async () => {
      await db.upsertMemberBadge(guildId, FAKE_USER_ID, TEST_BADGE_THRESH);
    }));

    results.push(await test('getMemberBadges trả về array có badge', async () => {
      const rows = await db.getMemberBadges(guildId, FAKE_USER_ID);
      if (!Array.isArray(rows)) throw new Error('not array');
      const found = rows.find(r => r.threshold === TEST_BADGE_THRESH);
      if (!found) throw new Error('không tìm thấy member_badge');
    }));

    results.push(await test('deleteBadge', async () => {
      await db.deleteBadge(guildId, TEST_BADGE_THRESH);
      created = false;
      const rows = await db.getBadges(guildId);
      const found = rows.find(r => r.threshold === TEST_BADGE_THRESH);
      if (found) throw new Error('vẫn còn sau delete');
    }));
  } finally {
    // Xóa member_badge fake
    try {
      await db.supabase.from('member_badges')
        .delete()
        .eq('guild_id', guildId)
        .eq('user_id', FAKE_USER_ID)
        .eq('threshold', TEST_BADGE_THRESH);
    } catch (_) { /* ignore */ }
    // Xóa badge nếu deleteBadge chưa chạy
    if (created) {
      try { await db.deleteBadge(guildId, TEST_BADGE_THRESH); } catch (_) { /* ignore */ }
    }
  }

  return results;
}

module.exports = badgesSuite;
