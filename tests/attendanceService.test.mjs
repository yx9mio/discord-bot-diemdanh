import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
    range: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    maybeSingle: mockMaybeSingle,
    single: mockSingle,
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  const mc = { from: vi.fn(() => qb), rpc: vi.fn() };
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
vi.mock('../utils/sentry.js', () => ({ addBreadcrumb: vi.fn() }));

import {
  upsertAttendance, upsertAttendanceNoTime,
  getAttendances, getAttendancesByUser, getAttendanceStats, getAllAttendances,
  bulkInsertAbsent,
  tryAcquireAttendanceLock, releaseAttendanceLock,
} from '../services/attendanceService.js';

afterEach(() => {
  vi.clearAllMocks();
});

const guildId = 'guild_01';
const sessionId = 'session_01';
const userId = 'user_01';
const mockAttendance = { id: 'att_01', session_id: sessionId, guild_id: guildId, user_id: userId, username: 'TestUser', status: 'tham_gia', marked_by: 'system', checked_in_at: new Date().toISOString() };

describe('Attendance — CRUD', () => {
  it('upserts attendance with status', async () => {
    mockQueryBuilder.single.mockResolvedValueOnce({ data: mockAttendance, error: null });
    const result = await upsertAttendance({ session_id: sessionId, guild_id: guildId, user_id: userId, status: 'tham_gia' });
    expect(result).toBeDefined();
    expect(mockClient.from).toHaveBeenCalledWith('attendances');
    expect(mockQueryBuilder.upsert).toHaveBeenCalledOnce();
  });

  it('attendance increments — mark present (tham_gia)', async () => {
    mockQueryBuilder.single.mockResolvedValueOnce({ data: { ...mockAttendance, status: 'tham_gia' }, error: null });
    const result = await upsertAttendance({ session_id: sessionId, guild_id: guildId, user_id: userId, status: 'tham_gia' });
    expect(result.status).toBe('tham_gia');
  });

  it('attendance increments — mark late (tre)', async () => {
    mockQueryBuilder.single.mockResolvedValueOnce({ data: { ...mockAttendance, status: 'tre' }, error: null });
    const result = await upsertAttendance({ session_id: sessionId, guild_id: guildId, user_id: userId, status: 'tre' });
    expect(result.status).toBe('tre');
  });

  it('attendance increments — mark absent (khong_tham_gia)', async () => {
    mockQueryBuilder.single.mockResolvedValueOnce({ data: { ...mockAttendance, status: 'khong_tham_gia' }, error: null });
    const result = await upsertAttendance({ session_id: sessionId, guild_id: guildId, user_id: userId, status: 'khong_tham_gia' });
    expect(result.status).toBe('khong_tham_gia');
  });

  it('changes present → late (update)', async () => {
    mockQueryBuilder.single.mockResolvedValueOnce({ data: { ...mockAttendance, status: 'tre' }, error: null });
    const result = await upsertAttendance({ session_id: sessionId, guild_id: guildId, user_id: userId, status: 'tre' });
    expect(result.status).toBe('tre');
  });

  it('changes late → present (update)', async () => {
    mockQueryBuilder.single.mockResolvedValueOnce({ data: { ...mockAttendance, status: 'tham_gia' }, error: null });
    const result = await upsertAttendance({ session_id: sessionId, guild_id: guildId, user_id: userId, status: 'tham_gia' });
    expect(result.status).toBe('tham_gia');
  });

  it('upserts attendance without time', async () => {
    mockQueryBuilder.single.mockResolvedValueOnce({ data: mockAttendance, error: null });
    const result = await upsertAttendanceNoTime(sessionId, guildId, userId, 'TestUser', 'tham_gia', 'admin');
    expect(result).toBeDefined();
  });

  it('gets attendances by session', async () => {
    mockQueryBuilder.select.mockReturnThis();
    mockQueryBuilder.eq.mockResolvedValueOnce({ data: [mockAttendance], error: null });
    const result = await getAttendances(sessionId);
    expect(Array.isArray(result)).toBe(true);
  });

  it('gets attendances by user', async () => {
    mockQueryBuilder.limit.mockResolvedValueOnce({ data: [mockAttendance], error: null });
    const result = await getAttendancesByUser(guildId, userId);
    expect(Array.isArray(result)).toBe(true);
  });

  it('gets attendance stats', async () => {
    mockQueryBuilder.eq.mockResolvedValueOnce({ data: [{ status: 'tham_gia' }], error: null });
    const result = await getAttendanceStats(guildId, userId);
    expect(Array.isArray(result)).toBe(true);
  });

  it('gets all attendances', async () => {
    mockQueryBuilder.limit.mockResolvedValueOnce({ data: [mockAttendance], error: null });
    const result = await getAllAttendances(guildId);
    expect(Array.isArray(result)).toBe(true);
  });

  it('bulk inserts absent', async () => {
    mockQueryBuilder.upsert.mockResolvedValueOnce({ error: null });
    const rows = [{ user_id: 'u1', username: 'User1' }, { user_id: 'u2' }];
    await expect(bulkInsertAbsent(sessionId, guildId, rows)).resolves.toBeUndefined();
  });

  it('bulkInsertAbsent handles empty array', async () => {
    await expect(bulkInsertAbsent(sessionId, guildId, [])).resolves.toBeUndefined();
  });
});

describe('Attendance — Distributed Lock (L1 + L2)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('acquires lock for first request', async () => {
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockQueryBuilder.rpc?.mockResolvedValueOnce({ data: null, error: null });
    const result = await tryAcquireAttendanceLock(sessionId, userId);
    expect(result).toBe(true);
  });

  it('blocks second concurrent request', async () => {
    mockQueryBuilder.rpc?.mockResolvedValueOnce({ data: null, error: null });
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const first = await tryAcquireAttendanceLock(sessionId, userId);
    expect(first).toBe(true);
    const second = await tryAcquireAttendanceLock(sessionId, userId);
    expect(second).toBe(false);
  });

  it('releases lock', async () => {
    mockQueryBuilder.rpc?.mockResolvedValue({ data: null, error: null });
    mockQueryBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockQueryBuilder.delete.mockResolvedValueOnce({ error: null });
    await tryAcquireAttendanceLock(sessionId, userId);
    await releaseAttendanceLock(sessionId, userId);
    expect(mockQueryBuilder.delete).toHaveBeenCalled();
  });
});
