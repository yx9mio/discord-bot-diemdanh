import { describe, it, expect, vi, afterEach } from 'vitest';

const { mockClient } = vi.hoisted(() => {
  const mc = { rpc: vi.fn() };
  return { mockClient: mc };
});

vi.mock('../services/_client.js', () => ({
  getClient: () => mockClient,
  _throwSupabase: vi.fn(),
  _validateSession: (row) => row,
  _validateAttendances: (rows) => rows,
  SESSION_TIME_COLUMN: 'started_at',
}));

vi.mock('../utils/logger.js', () => ({ default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

import { tryAcquireLeadership, renewLeadership, releaseLeadership } from '../utils/schedulerLock.js';

afterEach(() => {
  vi.clearAllMocks();
});

const jobName = 'daily_auto_open';

describe('Scheduler Leadership', () => {
  it('acquires leadership when RPC returns true', async () => {
    mockClient.rpc.mockResolvedValueOnce({ data: true, error: null });
    const result = await tryAcquireLeadership(jobName);
    expect(result).toBe(true);
    expect(mockClient.rpc).toHaveBeenCalledWith('try_acquire_scheduler_lock', expect.objectContaining({ p_job_name: jobName }));
  });

  it('fails to acquire when RPC returns false (second instance)', async () => {
    mockClient.rpc.mockResolvedValueOnce({ data: false, error: null });
    const result = await tryAcquireLeadership(jobName);
    expect(result).toBe(false);
  });

  it('returns false on RPC error', async () => {
    mockClient.rpc.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });
    const result = await tryAcquireLeadership(jobName);
    expect(result).toBe(false);
  });

  it('renews leadership successfully', async () => {
    mockClient.rpc.mockResolvedValueOnce({ data: true, error: null });
    const result = await renewLeadership(jobName);
    expect(result).toBe(true);
    expect(mockClient.rpc).toHaveBeenCalledWith('try_acquire_scheduler_lock', expect.any(Object));
  });

  it('renewLeadership returns false when lock lost', async () => {
    mockClient.rpc.mockResolvedValueOnce({ data: false, error: null });
    const result = await renewLeadership(jobName);
    expect(result).toBe(false);
  });

  it('renewLeadership returns false on error', async () => {
    mockClient.rpc.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });
    const result = await renewLeadership(jobName);
    expect(result).toBe(false);
  });

  it('releases leadership', async () => {
    mockClient.rpc.mockResolvedValueOnce({ error: null });
    await expect(releaseLeadership(jobName)).resolves.toBeUndefined();
    expect(mockClient.rpc).toHaveBeenCalledWith('release_scheduler_lock', expect.any(Object));
  });

  it('releaseLeadership handles RPC error gracefully', async () => {
    mockClient.rpc.mockResolvedValueOnce({ error: { message: 'DB error' } });
    await expect(releaseLeadership(jobName)).resolves.toBeUndefined();
  });
});
