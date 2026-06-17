import { describe, it, expect, vi, afterEach } from 'vitest';

const { mockClient, mockQueryBuilder } = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  const qb = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    maybeSingle: mockMaybeSingle,
  };
  const mc = { from: vi.fn(() => qb) };
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
vi.mock('discord.js', () => ({ WebhookClient: vi.fn(() => ({ send: vi.fn() })) }));

import { auditLog, getAuditLogs, getAuditLogCount, cleanupAuditLogs } from '../utils/auditLog.js';

afterEach(() => {
  vi.clearAllMocks();
});

const guildId = 'guild_01';
const actorId = 'actor_01';
const targetId = 'target_01';

describe('Audit Log System', () => {
  it('writes audit log entry', async () => {
    mockQueryBuilder.insert.mockResolvedValueOnce({ error: null });
    await expect(auditLog({ guildId, actorId, action: 'SESSION_CREATE', targetId })).resolves.toBeUndefined();
    expect(mockClient.from).toHaveBeenCalledWith('audit_logs');
    expect(mockQueryBuilder.insert).toHaveBeenCalledOnce();
  });

  it('writes OWNER_BYPASS audit entry', async () => {
    mockQueryBuilder.insert.mockResolvedValueOnce({ error: null });
    await expect(auditLog({ guildId, actorId, action: 'OWNER_BYPASS', metadata: { context: 'test' } })).resolves.toBeUndefined();
  });

  it('writes CONFIG_UPDATE audit entry', async () => {
    mockQueryBuilder.insert.mockResolvedValueOnce({ error: null });
    await expect(auditLog({ guildId, actorId, action: 'CONFIG_UPDATE', metadata: { field: 'timezone' } })).resolves.toBeUndefined();
  });

  it('writes MEMBER_UPDATE audit entry', async () => {
    mockQueryBuilder.insert.mockResolvedValueOnce({ error: null });
    await expect(auditLog({ guildId, actorId, action: 'MEMBER_UPDATE', targetId })).resolves.toBeUndefined();
  });

  it('writes RESET_STREAK audit entry', async () => {
    mockQueryBuilder.insert.mockResolvedValueOnce({ error: null });
    await expect(auditLog({ guildId, actorId, action: 'RESET_STREAK', metadata: { type: 'single' } })).resolves.toBeUndefined();
  });

  it('reads audit logs', async () => {
    mockQueryBuilder.range.mockResolvedValueOnce({ data: [{ id: 1, guild_id: guildId, action: 'SESSION_CREATE', actor_id: actorId }], error: null });
    const result = await getAuditLogs({ guildId });
    expect(result.rows).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('gets audit log count', async () => {
    mockQueryBuilder.select.mockReturnThis();
    mockQueryBuilder.eq.mockReturnThis();
    const headQuery = vi.fn().mockResolvedValueOnce({ count: 5, error: null });
    mockQueryBuilder.select.mockReturnValueOnce({ eq: vi.fn().mockReturnValueOnce({ eq: vi.fn().mockReturnValueOnce(headQuery) }) });
    const result = await getAuditLogCount({ guildId });
    expect(result).toBe(5);
  });

  it('cleanup deletes old records', async () => {
    mockQueryBuilder.lt.mockResolvedValueOnce({ error: null });
    const result = await cleanupAuditLogs();
    expect(result).toBe(1);
    expect(mockQueryBuilder.delete).toHaveBeenCalled();
    expect(mockQueryBuilder.lt).toHaveBeenCalled();
  });
});
