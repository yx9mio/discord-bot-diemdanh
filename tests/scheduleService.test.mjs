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
    range: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
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
vi.mock('../utils/sentry.js', () => ({ addBreadcrumb: vi.fn() }));

import {
  getScheduledSessions, getScheduledSessionById,
  createScheduledSession, updateScheduledSession, deleteScheduledSession, skipScheduledSession,
  addRecurringSession, addOnetimeSession,
  getDueReminders, markReminderSent,
} from '../services/scheduledService.js';

afterEach(() => {
  vi.clearAllMocks();
});

const guildId = 'guild_01';
const scheduleId = 'sch_01';
const mockSchedule = {
  id: scheduleId, guild_id: guildId, day_of_week: 2, hour: 20, minute: 0,
  session_name: 'Điểm danh', is_active: true, channel_id: null,
  close_hour: null, close_minute: null, pre_close_minutes: 30,
  reminder_enabled: true, type: 'recurring_weekly',
};

describe('Schedule — CRUD', () => {
  it('creates a schedule', async () => {
    mockQueryBuilder.single.mockResolvedValueOnce({ data: mockSchedule, error: null });
    const result = await createScheduledSession({ guild_id: guildId, day_of_week: 2, hour: 20, minute: 0 });
    expect(result).toBeDefined();
    expect(result.id).toBe(scheduleId);
    expect(mockClient.from).toHaveBeenCalledWith('scheduled_sessions');
  });

  it('gets scheduled sessions', async () => {
    mockQueryBuilder.select.mockReturnThis();
    mockQueryBuilder.eq.mockResolvedValueOnce({ data: [mockSchedule], error: null });
    const result = await getScheduledSessions(guildId);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it('gets schedule by id', async () => {
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: mockSchedule, error: null });
    const result = await getScheduledSessionById(scheduleId);
    expect(result).toBeDefined();
  });

  it('updates a schedule', async () => {
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: { ...mockSchedule, hour: 21 }, error: null });
    const result = await updateScheduledSession(guildId, scheduleId, { hour: 21 });
    expect(result).toBeDefined();
    expect(result.hour).toBe(21);
  });

  it('updateScheduledSession — missing row does not throw (maybeSingle regression)', async () => {
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await updateScheduledSession(guildId, 'nonexistent', { hour: 21 });
    expect(result).toBeNull();
  });

  it('deletes a schedule (atomic)', async () => {
    mockQueryBuilder.delete.mockReturnThis();
    mockQueryBuilder.eq.mockReturnThis();
    mockQueryBuilder.select.mockReturnThis();
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: mockSchedule, error: null });
    const result = await deleteScheduledSession(guildId, scheduleId);
    expect(result).toBe(true);
    expect(mockQueryBuilder.delete).toHaveBeenCalled();
    expect(mockQueryBuilder.select).toHaveBeenCalled();
  });

  it('deleteScheduledSession returns false for missing row', async () => {
    mockQueryBuilder.delete.mockReturnThis();
    mockQueryBuilder.eq.mockReturnThis();
    mockQueryBuilder.select.mockReturnThis();
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await deleteScheduledSession(guildId, 'nonexistent');
    expect(result).toBe(false);
  });

  it('skips a schedule', async () => {
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: { ...mockSchedule, skip_until: '2026-07-01' }, error: null });
    const result = await skipScheduledSession(scheduleId, '2026-07-01');
    expect(result).toBe(true);
  });

  it('skipScheduledSession — missing row does not throw (maybeSingle regression)', async () => {
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await skipScheduledSession('nonexistent', '2026-07-01');
    expect(result).toBe(false);
  });
});

describe('Schedule — Wrappers & Reminders', () => {
  it('addRecurringSession creates with defaults', async () => {
    mockQueryBuilder.single.mockResolvedValueOnce({ data: mockSchedule, error: null });
    const result = await addRecurringSession(guildId, { thu: 2, gio_bat_dau: '20:00', timezone: 'Asia/Ho_Chi_Minh' });
    expect(result).toBeDefined();
    expect(mockQueryBuilder.insert).toHaveBeenCalled();
  });

  it('addOnetimeSession creates with parsed date', async () => {
    mockQueryBuilder.single.mockResolvedValueOnce({ data: { ...mockSchedule, type: 'one_time', scheduled_date: '2026-06-20' }, error: null });
    const result = await addOnetimeSession(guildId, { ngay: '20/06/2026', gio_bat_dau: '20:00', timezone: 'Asia/Ho_Chi_Minh' });
    expect(result).toBeDefined();
  });

  it('addOnetimeSession handles ISO date format', async () => {
    mockQueryBuilder.single.mockResolvedValueOnce({ data: { ...mockSchedule, type: 'one_time', scheduled_date: '2026-06-20' }, error: null });
    const result = await addOnetimeSession(guildId, { ngay: '2026-06-20', gio_bat_dau: '20:00', timezone: 'Asia/Ho_Chi_Minh' });
    expect(result).toBeDefined();
  });

  it('gets due reminders', async () => {
    mockQueryBuilder.lte.mockResolvedValueOnce({ data: [{ id: 'r1', due_at: '2026-06-16T10:00:00Z' }], error: null });
    const result = await getDueReminders(new Date('2026-06-16T12:00:00Z'));
    expect(Array.isArray(result)).toBe(true);
  });

  it('marks reminder sent', async () => {
    mockQueryBuilder.eq.mockResolvedValueOnce({ error: null });
    await expect(markReminderSent('r1')).resolves.toBeUndefined();
  });
});
