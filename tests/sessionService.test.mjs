import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  createSession, getActiveSession, getActiveSessions,
  getSessionById, getSessionByMessageId, getSessionByIdRaw,
  closeSession, cancelSession,
  updateSessionName, updateSessionEligible, updateSessionMessage,
  getRecentSessions, getAllSessions,
} from '../services/sessionService.js';

afterEach(() => {
  vi.clearAllMocks();
});

const guildId = 'guild_01';
const sessionId = 'session_01';
const mockSession = { id: sessionId, guild_id: guildId, session_name: 'Test Kỳ', is_active: true, cancelled: false, started_at: new Date().toISOString(), eligible_member_ids: [], phai_role_ids: [] };

describe('Session Lifecycle — Create', () => {
  it('creates a session and returns it', async () => {
    mockQueryBuilder.single.mockResolvedValueOnce({ data: mockSession, error: null });
    const result = await createSession({ guildId, sessionName: 'Test Kỳ' });
    expect(result).toBeDefined();
    expect(result.id).toBe(sessionId);
    expect(mockClient.from).toHaveBeenCalledWith('sessions');
    expect(mockQueryBuilder.insert).toHaveBeenCalledOnce();
  });

  it('rejects when duplicate open session exists', async () => {
    mockQueryBuilder.single.mockResolvedValueOnce({ data: null, error: { message: 'duplicate key', code: '23505' } });
    await expect(createSession({ guildId, sessionName: 'Test Kỳ' })).rejects.toThrow();
  });
});

describe('Session Lifecycle — Read', () => {
  it('gets active session', async () => {
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: mockSession, error: null });
    const result = await getActiveSession(guildId);
    expect(result).toBeDefined();
    expect(result.id).toBe(sessionId);
  });

  it('returns null for missing active session', async () => {
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await getActiveSession(guildId);
    expect(result).toBeNull();
  });

  it('gets active sessions list', async () => {
    mockQueryBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockQueryBuilder.select.mockReturnThis();
    const sessions = [mockSession];
    const origThen = mockQueryBuilder.order;
    mockQueryBuilder.order.mockResolvedValueOnce({ data: sessions, error: null });
    const result = await getActiveSessions(guildId);
    expect(Array.isArray(result)).toBe(true);
  });

  it('gets session by id', async () => {
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: mockSession, error: null });
    const result = await getSessionById(sessionId);
    expect(result).toBeDefined();
  });

  it('gets session by message id', async () => {
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: mockSession, error: null });
    const result = await getSessionByMessageId('msg_01');
    expect(result).toBeDefined();
  });

  it('gets session by id raw', async () => {
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: mockSession, error: null });
    const result = await getSessionByIdRaw(sessionId, guildId);
    expect(result).toBeDefined();
  });
});

describe('Session Lifecycle — Close / Cancel', () => {
  afterEach(() => vi.clearAllMocks());

  it('closes a session', async () => {
    mockQueryBuilder.single.mockResolvedValueOnce({ data: null, error: null });
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: { ...mockSession, is_active: false, ended_at: new Date().toISOString() }, error: null });
    const result = await closeSession(sessionId, guildId);
    expect(result).toBeDefined();
    expect(mockQueryBuilder.update).toHaveBeenCalled();
  });

  it('closeSession — missing row does not throw (maybeSingle regression)', async () => {
    mockQueryBuilder.single.mockResolvedValueOnce({ data: null, error: null });
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await closeSession(sessionId, guildId);
    expect(result).toBeNull();
  });

  it('cancels a session', async () => {
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: { ...mockSession, is_active: false, cancelled: true }, error: null });
    const result = await cancelSession(sessionId, guildId);
    expect(result).toBeDefined();
    expect(mockQueryBuilder.update).toHaveBeenCalled();
  });

  it('cancelSession — missing row does not throw (maybeSingle regression)', async () => {
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await cancelSession(sessionId, guildId);
    expect(result).toBeNull();
  });
});

describe('Session Lifecycle — Update', () => {
  it('updates session name', async () => {
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: { ...mockSession, session_name: 'New Name' }, error: null });
    const result = await updateSessionName(sessionId, 'New Name');
    expect(result).toBeDefined();
    expect(mockQueryBuilder.update).toHaveBeenCalled();
  });

  it('updateSessionName — missing row does not throw (maybeSingle regression)', async () => {
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await updateSessionName(sessionId, 'New Name');
    expect(result).toBeNull();
  });

  it('updates eligible member ids', async () => {
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: { ...mockSession, eligible_member_ids: ['u1', 'u2'] }, error: null });
    const result = await updateSessionEligible(sessionId, ['u1', 'u2']);
    expect(result).toBeDefined();
  });

  it('updateSessionEligible — missing row does not throw (maybeSingle regression)', async () => {
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await updateSessionEligible(sessionId, ['u1']);
    expect(result).toBeNull();
  });

  it('updateSessionMessage stores message_id', async () => {
    mockQueryBuilder.single.mockResolvedValue({ data: null, error: null });
    mockQueryBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });
    await updateSessionMessage(sessionId, 'msg_01');
    expect(mockQueryBuilder.update).toHaveBeenCalled();
  });

  it('getRecentSessions returns array', async () => {
    mockQueryBuilder.order.mockResolvedValueOnce({ data: [mockSession], error: null });
    const result = await getRecentSessions(guildId);
    expect(Array.isArray(result)).toBe(true);
  });

  it('getRecentSessions returns empty array for no data', async () => {
    mockQueryBuilder.order.mockResolvedValueOnce({ data: null, error: null });
    const result = await getRecentSessions(guildId);
    expect(result).toEqual([]);
  });

  it('getAllSessions returns array', async () => {
    mockQueryBuilder.order.mockResolvedValueOnce({ data: [mockSession], error: null });
    const result = await getAllSessions(guildId);
    expect(Array.isArray(result)).toBe(true);
  });
});
