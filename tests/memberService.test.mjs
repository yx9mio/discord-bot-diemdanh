import { describe, it, expect, vi, afterEach } from 'vitest';

const { mockClient, mockQueryBuilder } = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  const mockSingle = vi.fn();
  const qb = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    maybeSingle: mockMaybeSingle,
    single: mockSingle,
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  const mc = { from: vi.fn(() => qb), rpc: vi.fn().mockResolvedValue({ data: null, error: null }) };
  return { mockClient: mc, mockQueryBuilder: qb };
});

vi.mock('../services/_client.js', () => ({
  getClient: () => mockClient,
  _throwSupabase: (err, ctx) => { if (err) throw new Error(`[DB:${ctx}] ${err.message || err}`); },
  _validateSession: (row) => row,
  _validateAttendances: (rows) => rows,
  SESSION_TIME_COLUMN: 'started_at',
}));

vi.mock('../utils/logger.js', () => ({ default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

import {
  getMembers, getMember, addMember, deleteMember, upsertMember,
  getServerStats, getDistinctPhongBan,
  resetStreak, batchResetStreak,
  upsertMemberStats, batchUpsertMemberStats,
} from '../services/memberService.js';

afterEach(() => {
  vi.clearAllMocks();
});

const guildId = 'guild_01';
const userId = 'user_01';
const mockMember = { id: 1, guild_id: guildId, user_id: userId, username: 'TestUser', phong_ban: 'IT', ghi_chu: '' };

describe('Member — CRUD', () => {
  it('gets members list', async () => {
    mockQueryBuilder.order.mockResolvedValueOnce({ data: [mockMember], error: null });
    const result = await getMembers(guildId);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it('gets member by id', async () => {
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: mockMember, error: null });
    const result = await getMember(guildId, userId);
    expect(result).toBeDefined();
  });

  it('returns null for missing member', async () => {
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await getMember(guildId, 'nonexistent');
    expect(result).toBeNull();
  });

  it('adds a member', async () => {
    mockQueryBuilder.single.mockResolvedValueOnce({ data: mockMember, error: null });
    const result = await addMember({ guild_id: guildId, user_id: userId, username: 'TestUser' });
    expect(result).toBeDefined();
    expect(result.user_id).toBe(userId);
  });

  it('deletes a member', async () => {
    mockQueryBuilder.eq.mockResolvedValueOnce({ error: null });
    await expect(deleteMember(guildId, userId)).resolves.toBeUndefined();
  });

  it('upsertMember: async function completes (regression: missing await)', async () => {
    mockQueryBuilder.single.mockResolvedValueOnce({ data: mockMember, error: null });
    const result = await upsertMember({ guildId, userId, username: 'TestUser' });
    expect(result).toBeDefined();
    expect(mockQueryBuilder.upsert).toHaveBeenCalled();
  });
});

describe('Member — Stats', () => {
  it('upserts member stats', async () => {
    mockQueryBuilder.single.mockResolvedValueOnce({ data: { guild_id: guildId, user_id: userId, total_joined: 1 }, error: null });
    const result = await upsertMemberStats({ guild_id: guildId, user_id: userId, total_joined: 1 });
    expect(result).toBeDefined();
  });

  it('batch upserts member stats', async () => {
    mockQueryBuilder.upsert.mockResolvedValueOnce({ error: null });
    const patches = [{ user_id: 'u1', total_joined: 1 }, { user_id: 'u2', total_joined: 2 }];
    await expect(batchUpsertMemberStats(guildId, patches)).resolves.toBeUndefined();
  });

  it('batch upsert handles empty array', async () => {
    await expect(batchUpsertMemberStats(guildId, [])).resolves.toBeUndefined();
  });

  it('resets streak for single member', async () => {
    mockQueryBuilder.update.mockReturnThis();
    mockQueryBuilder.eq.mockResolvedValueOnce({ error: null });
    await expect(resetStreak(guildId, userId)).resolves.toBeUndefined();
  });

  it('batch resets streak for multiple members', async () => {
    mockQueryBuilder.update.mockReturnThis();
    mockQueryBuilder.in.mockResolvedValueOnce({ error: null });
    await expect(batchResetStreak(guildId, ['u1', 'u2'])).resolves.toBeUndefined();
  });

  it('batch reset handles empty array', async () => {
    await expect(batchResetStreak(guildId, [])).resolves.toBeUndefined();
  });

  it('getServerStats returns computed stats', async () => {
    mockQueryBuilder.gte?.mockReturnThis();
    mockQueryBuilder.lte?.mockReturnThis();
    mockQueryBuilder.select.mockReturnThis();
    mockQueryBuilder.eq.mockReturnThis();
    mockQueryBuilder.in?.mockReturnThis();
    mockQueryBuilder.limit?.mockReturnThis();
    mockQueryBuilder.order.mockResolvedValueOnce({ data: [{ id: 's1' }], error: null });
    mockQueryBuilder.in.mockResolvedValueOnce({ data: [{ status: 'tham_gia' }, { status: 'tre' }], error: null });
    mockQueryBuilder.eq.mockResolvedValueOnce({ data: [{ user_id: 'u1' }], error: null });
    const result = await getServerStats(guildId);
    expect(result).toBeDefined();
    expect(result.total_sessions).toBe(1);
    expect(result.total_present).toBe(1);
    expect(result.total_late).toBe(1);
  });

  it('getDistinctPhongBan returns sorted array', async () => {
    mockQueryBuilder.not?.mockResolvedValueOnce({ data: [{ phong_ban: 'IT' }, { phong_ban: 'HR' }], error: null });
    const result = await getDistinctPhongBan(guildId);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toContain('IT');
  });
});
