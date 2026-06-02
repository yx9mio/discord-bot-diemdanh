// tests/integration/db.test.js
// Chỉ chạy khi có env SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// CI mặc định skip — chỉ chạy trong job riêng có secrets

import { describe, it, expect, beforeAll } from 'vitest';

const hasEnv =
  !!process.env.SUPABASE_URL &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY;

const TEST_GUILD = 'TEST_GUILD_CI_' + Date.now();

(hasEnv ? describe : describe.skip)('db integration — requires SUPABASE env', () => {
  let db;

  beforeAll(async () => {
    db = await import('../../db.js');
  });

  it('getGuildConfig: trả về null hoặc object khi guild chưa config', async () => {
    const cfg = await db.getGuildConfig(TEST_GUILD);
    expect(cfg === null || typeof cfg === 'object').toBe(true);
  });

  it('upsertGuildConfig rồi getGuildConfig trả đúng data', async () => {
    await db.upsertGuildConfig({ guild_id: TEST_GUILD, log_channel_id: 'ch_log_test', admin_role_id: null });
    const result = await db.getGuildConfig(TEST_GUILD);
    expect(result).not.toBeNull();
    expect(result.log_channel_id).toBe('ch_log_test');
  });

  it('createSession tạo session có is_active=true', async () => {
    const sess = await db.createSession({
      guild_id: TEST_GUILD, session_name: 'CI Test Session',
      started_by: 'u_ci_test', channel_id: 'ch_ci',
    });
    expect(sess).toHaveProperty('id');
    expect(sess.is_active).toBe(true);
  });

  it('getActiveSession trả về session vừa tạo', async () => {
    const active = await db.getActiveSession(TEST_GUILD);
    expect(active).not.toBeNull();
    expect(active.session_name).toBe('CI Test Session');
  });

  it('upsertAttendance ghi + getAttendances đọc lại', async () => {
    const active = await db.getActiveSession(TEST_GUILD);
    await db.upsertAttendance({
      session_id: active.id, guild_id: TEST_GUILD,
      user_id: 'u_ci_member', username: 'ci_user',
      status: 'tham_gia', marked_by: 'u_ci_member',
      checked_in_at: new Date().toISOString(),
    });
    const rows = await db.getAttendances(active.id);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.find(r => r.user_id === 'u_ci_member').status).toBe('tham_gia');
  });

  it('closeSession → getActiveSession trả null', async () => {
    const active = await db.getActiveSession(TEST_GUILD);
    await db.closeSession(active.id, TEST_GUILD);
    expect(await db.getActiveSession(TEST_GUILD)).toBeNull();
  });
});