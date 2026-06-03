// tests/unit/dbNewFunctions.test.js
// Test: 6 functions mới thêm vào db.js
// - ensureGuildConfig, upsertMember, getSessionByIdRaw,
//   getTopMembers, getServerStats, getAllAttendances
//
// Pattern: delete require.cache cho db.js giữa các test
// để clear `_supabase` lazy-init cache.

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

let currentMockClient;
const dbPath = require.resolve('../../db.js');

beforeAll(() => {
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_KEY = 'test-key';
  // Mock @supabase/supabase-js
  require.cache[require.resolve('@supabase/supabase-js')] = {
    exports: { createClient: () => currentMockClient },
    loaded: true,
    id: 'supabase-mock',
    filename: 'supabase-mock',
  };
});

beforeEach(() => {
  currentMockClient = undefined;
  // Clear db.js cache → `_supabase = null` ở lần load tiếp theo
  delete require.cache[dbPath];
  // Đảm bảo mock @supabase vẫn còn (clearModules ở trên không ảnh hưởng vì ta set trực tiếp vào cache)
  require.cache[require.resolve('@supabase/supabase-js')] = {
    exports: { createClient: () => currentMockClient },
    loaded: true,
    id: 'supabase-mock',
    filename: 'supabase-mock',
  };
});

function loadDb() {
  return require('../../db.js');
}

function setClient(client) {
  currentMockClient = client;
}

describe('db.js — functions mới (Commit 1)', () => {
  it('ensureGuildConfig: gọi upsert ignoreDuplicates với guild_id', async () => {
    const upsert = vi.fn().mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: { guild_id: 'g1' }, error: null }) }),
    });
    setClient({ from: vi.fn().mockReturnValue({ upsert }) });
    const db = loadDb();
    const result = await db.ensureGuildConfig('g1');
    expect(upsert).toHaveBeenCalledWith({ guild_id: 'g1' }, { onConflict: 'guild_id', ignoreDuplicates: true });
    expect(result).toEqual({ guild_id: 'g1' });
  });

  it('upsertMember: chuẩn hoá camelCase → snake_case + defaults null', async () => {
    const upsert = vi.fn().mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }),
    });
    setClient({ from: vi.fn().mockReturnValue({ upsert }) });
    const db = loadDb();
    await db.upsertMember({ guildId: 'g1', userId: 'u1', phongBan: 'p1' });
    expect(upsert).toHaveBeenCalledWith(
      { guild_id: 'g1', user_id: 'u1', phong_ban: 'p1', ghi_chu: null, username: null },
      { onConflict: 'guild_id,user_id' }
    );
  });

  it('upsertMember: ghi_chu + username truyền qua đúng', async () => {
    const upsert = vi.fn().mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }),
    });
    setClient({ from: vi.fn().mockReturnValue({ upsert }) });
    const db = loadDb();
    await db.upsertMember({ guildId: 'g1', userId: 'u1', ghiChu: 'VIP', username: 'Alice' });
    expect(upsert).toHaveBeenCalledWith(
      { guild_id: 'g1', user_id: 'u1', phong_ban: null, ghi_chu: 'VIP', username: 'Alice' },
      { onConflict: 'guild_id,user_id' }
    );
  });

  it('getSessionByIdRaw: filter cả id + guild_id (chống IDOR)', async () => {
    const eq = vi.fn().mockReturnThis();
    const select = vi.fn().mockReturnThis();
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 's1', guild_id: 'g1' }, error: null });
    setClient({ from: vi.fn().mockReturnValue({ select, eq, maybeSingle }) });
    const db = loadDb();
    await db.getSessionByIdRaw('s1', 'g1');
    const eqCalls = eq.mock.calls.map(c => c[0]);
    expect(eqCalls).toContain('id');
    expect(eqCalls).toContain('guild_id');
  });

  it('getTopMembers: order desc + limit', async () => {
    const order = vi.fn().mockReturnThis();
    const limit = vi.fn().mockResolvedValue({ data: [{ user_id: 'u1' }], error: null });
    const select = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    setClient({ from: vi.fn().mockReturnValue({ select, eq, order, limit }) });
    const db = loadDb();
    const result = await db.getTopMembers('g1', 5);
    expect(order).toHaveBeenCalledWith('total_joined', { ascending: false });
    expect(limit).toHaveBeenCalledWith(5);
    expect(result).toEqual([{ user_id: 'u1' }]);
  });

  it('getServerStats: 3 queries song song, trả 4 trường', async () => {
    const responses = [
      { count: 10, data: new Array(10).fill({ id: 1 }) },
      { count: 5,  data: new Array(5).fill({ id: 1 }) },
      { count: 20, data: new Array(15).fill({ status: 'tham_gia' }).concat(new Array(5).fill({ status: 'khong_tham_gia' })) },
    ];
    let i = 0;
    // Thenable: có thể chain .eq() nhiều lần, await ở bất cứ điểm nào
    const makeThenable = (val) => {
      const obj = {
        eq: vi.fn().mockImplementation(() => makeThenable(val)),
        then: (resolve, reject) => Promise.resolve(val).then(resolve, reject),
      };
      return obj;
    };
    setClient({
      from: vi.fn().mockImplementation(() => ({
        select: () => makeThenable(responses[i++]),
      })),
    });
    const db = loadDb();
    const stats = await db.getServerStats('g1');
    expect(stats.total_sessions).toBe(10);
    expect(stats.total_members).toBe(5);
    expect(stats.total_attendances).toBe(20);
    expect(stats.rate_present).toBe(75);
  });

  it('getServerStats: guild rỗng → 0/0', async () => {
    const makeThenable = (val) => {
      const obj = {
        eq: vi.fn().mockImplementation(() => makeThenable(val)),
        then: (resolve, reject) => Promise.resolve(val).then(resolve, reject),
      };
      return obj;
    };
    setClient({
      from: vi.fn().mockImplementation(() => ({
        select: () => makeThenable({ count: 0, data: [] }),
      })),
    });
    const db = loadDb();
    const stats = await db.getServerStats('empty');
    expect(stats.total_sessions).toBe(0);
    expect(stats.total_attendances).toBe(0);
    expect(stats.rate_present).toBe(0);
  });

  it('getAllAttendances: limit mặc định 5000, order desc theo checked_in_at', async () => {
    const order = vi.fn().mockReturnThis();
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const select = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    setClient({ from: vi.fn().mockReturnValue({ select, eq, order, limit }) });
    const db = loadDb();
    await db.getAllAttendances('g1');
    expect(order).toHaveBeenCalledWith('checked_in_at', { ascending: false });
    expect(limit).toHaveBeenCalledWith(5000);
  });

  it('getAllAttendances: truyền limit tuỳ chỉnh', async () => {
    const order = vi.fn().mockReturnThis();
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const select = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    setClient({ from: vi.fn().mockReturnValue({ select, eq, order, limit }) });
    const db = loadDb();
    await db.getAllAttendances('g1', 100);
    expect(limit).toHaveBeenCalledWith(100);
  });

  it('getMemberBadgesMulti: batch fetch badges cho nhiều users', async () => {
    const inFilter = vi.fn().mockReturnThis();
    const select = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const mockData = [
      { user_id: 'u1', badges: { threshold: 5 } },
      { user_id: 'u1', badges: { threshold: 10 } },
      { user_id: 'u2', badges: { threshold: 5 } },
    ];
    setClient({
      from: vi.fn().mockReturnValue({ select, eq, in: inFilter }),
    });
    inFilter.mockResolvedValue({ data: mockData, error: null });
    const db = loadDb();
    const result = await db.getMemberBadgesMulti('g1', ['u1', 'u2']);
    expect(inFilter).toHaveBeenCalledWith('user_id', ['u1', 'u2']);
    expect(result.u1).toHaveLength(2);
    expect(result.u2).toHaveLength(1);
  });

  it('getMemberBadgesMulti: empty userIds → return empty object', async () => {
    const db = loadDb();
    const result = await db.getMemberBadgesMulti('g1', []);
    expect(result).toEqual({});
  });

  it('batchUpsertUserBadges: batch insert badges', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    setClient({ from: vi.fn().mockReturnValue({ upsert }) });
    const db = loadDb();
    await db.batchUpsertUserBadges('g1', [
      { user_id: 'u1', threshold: 5 },
      { user_id: 'u2', threshold: 10 },
    ]);
    expect(upsert).toHaveBeenCalledWith(
      [
        { guild_id: 'g1', user_id: 'u1', threshold: 5 },
        { guild_id: 'g1', user_id: 'u2', threshold: 10 },
      ],
      { onConflict: 'guild_id,user_id,threshold' }
    );
  });

  it('batchUpsertUserBadges: empty badges → return early', async () => {
    const upsert = vi.fn();
    setClient({ from: vi.fn().mockReturnValue({ upsert }) });
    const db = loadDb();
    await db.batchUpsertUserBadges('g1', []);
    expect(upsert).not.toHaveBeenCalled();
  });
});
