// tests/integration/db.test.js
// Integration test DB layer với Supabase mock in-memory
// Thuật toán: State-based testing — kiểm tra state sau mỗi operation
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase in-memory ──────────────────────────────────────────────
const store = {
  sessions: [],
  attendances: [],
  member_stats: [],
  guild_config: [],
  badge_definitions: [],
  user_badges: [],
};

function makeSupabaseClient() {
  return {
    from: (table) => makeQuery(table),
  };
}

function makeQuery(table) {
  const _data = null;
  const _filters = [];
  let _isSingle = false;
  let _operation = 'select';
  let _payload = null;
  let _onConflict = null;

  const q = {
    select: (cols) => { _operation = 'select'; return q; },
    insert: (payload) => { _operation = 'insert'; _payload = payload; return q; },
    upsert: (payload, opts) => { _operation = 'upsert'; _payload = payload; _onConflict = opts?.onConflict; return q; },
    update: (payload) => { _operation = 'update'; _payload = payload; return q; },
    delete: () => { _operation = 'delete'; return q; },
    eq: (col, val) => { _filters.push({ col, val, op: 'eq' }); return q; },
    in: (col, vals) => { _filters.push({ col, vals, op: 'in' }); return q; },
    order: () => q,
    limit: () => q,
    maybeSingle: () => { _isSingle = true; return execute(); },
    single: () => { _isSingle = true; return execute(); },
  };

  function applyFilters(rows) {
    return rows.filter(row =>
      _filters.every(f => {
        if (f.op === 'eq')  return row[f.col] === f.val;
        if (f.op === 'in')  return f.vals.includes(row[f.col]);
        return true;
      })
    );
  }

  function execute() {
    const rows = store[table] ?? [];
    if (_operation === 'select') {
      const result = applyFilters(rows);
      if (_isSingle) return Promise.resolve({ data: result[0] ?? null, error: null });
      return Promise.resolve({ data: result, error: null });
    }
    if (_operation === 'insert') {
      const items = Array.isArray(_payload) ? _payload : [_payload];
      store[table].push(...items);
      if (_isSingle) return Promise.resolve({ data: items[0], error: null });
      return Promise.resolve({ data: items, error: null });
    }
    if (_operation === 'upsert') {
      const items = Array.isArray(_payload) ? _payload : [_payload];
      const conflictCols = (_onConflict ?? '').split(',').map(s => s.trim());
      for (const item of items) {
        const idx = store[table].findIndex(row =>
          conflictCols.every(col => row[col] === item[col])
        );
        if (idx >= 0) store[table][idx] = { ...store[table][idx], ...item };
        else store[table].push(item);
      }
      if (_isSingle) return Promise.resolve({ data: items[0], error: null });
      return Promise.resolve({ data: items, error: null });
    }
    if (_operation === 'update') {
      const filtered = applyFilters(store[table]);
      filtered.forEach(row => Object.assign(row, _payload));
      if (_isSingle) return Promise.resolve({ data: filtered[0] ?? null, error: null });
      return Promise.resolve({ data: filtered, error: null });
    }
    if (_operation === 'delete') {
      store[table] = store[table].filter(row =>
        !_filters.every(f => f.op === 'eq' && row[f.col] === f.val)
      );
      return Promise.resolve({ data: null, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  }

  // Attach async resolution cho select chain
  q.then = undefined; // prevent accidental await on builder
  Object.assign(q, execute());
  return q;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => makeSupabaseClient(),
}));
vi.mock('dotenv', () => ({ config: () => {} }));
process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_KEY = 'test-key';

const db = await import('../../db.js');

// ─── Tests ───────────────────────────────────────────────────────────────
beforeEach(() => {
  // Reset store trước mỗi test
  for (const k of Object.keys(store)) store[k] = [];
});

describe('db.upsertAttendance — BUG-1 regression', () => {
  it('nhận object payload → không throw', async () => {
    await expect(db.upsertAttendance({
      session_id: 's1', guild_id: 'g1', user_id: 'u1',
      username: 'Alice', status: 'tham_gia', marked_by: 'u1',
      checked_in_at: new Date().toISOString(),
    })).resolves.not.toThrow();
  });

  it('upsert lần 2 cùng session+user → update không duplicate', async () => {
    const payload = { session_id: 's1', guild_id: 'g1', user_id: 'u1', username: 'Alice', status: 'tham_gia', marked_by: 'u1' };
    await db.upsertAttendance(payload);
    await db.upsertAttendance({ ...payload, status: 'tre' });
    // Store chỉ có 1 row
    const atts = store.attendances.filter(a => a.session_id === 's1' && a.user_id === 'u1');
    expect(atts).toHaveLength(1);
    expect(atts[0].status).toBe('tre');
  });
});

describe('db.batchUpsertMemberStats — BUG-3 regression', () => {
  it('patches rỗng → không throw, không insert', async () => {
    await expect(db.batchUpsertMemberStats('g1', [])).resolves.toBeUndefined();
    expect(store.member_stats).toHaveLength(0);
  });

  it('batch 3 members → đúng 3 rows được upsert', async () => {
    await db.batchUpsertMemberStats('g1', [
      { user_id: 'u1', total_joined: 5, current_streak: 3, best_streak: 3 },
      { user_id: 'u2', total_joined: 2, current_streak: 1, best_streak: 2 },
      { user_id: 'u3', total_joined: 1, current_streak: 1, best_streak: 1 },
    ]);
    expect(store.member_stats).toHaveLength(3);
  });

  it('upsert lần 2 cùng guild+user → update không duplicate', async () => {
    await db.batchUpsertMemberStats('g1', [{ user_id: 'u1', total_joined: 1, current_streak: 1, best_streak: 1 }]);
    await db.batchUpsertMemberStats('g1', [{ user_id: 'u1', total_joined: 2, current_streak: 2, best_streak: 2 }]);
    const rows = store.member_stats.filter(r => r.guild_id === 'g1' && r.user_id === 'u1');
    expect(rows).toHaveLength(1);
    expect(rows[0].total_joined).toBe(2);
  });
});

describe('db aliases — BUG-4/5 regression', () => {
  it('getSessionHistory tồn tại và callable', () => {
    expect(typeof db.getSessionHistory).toBe('function');
  });

  it('getConfig tồn tại và callable', () => {
    expect(typeof db.getConfig).toBe('function');
  });

  it('getBadges tồn tại và callable', () => {
    expect(typeof db.getBadges).toBe('function');
  });

  it('getMemberBadges tồn tại và callable', () => {
    expect(typeof db.getMemberBadges).toBe('function');
  });

  it('upsertMemberBadge tồn tại và callable', () => {
    expect(typeof db.upsertMemberBadge).toBe('function');
  });
});

describe('db.closeSession — state change', () => {
  it('close session → is_active=false, có ended_at', async () => {
    store.sessions.push({ id: 's1', guild_id: 'g1', is_active: true, cancelled: false });
    const result = await db.closeSession('s1');
    expect(result.is_active).toBe(false);
    expect(result.ended_at).toBeDefined();
  });
});
