import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
}));

import { checkCooldown } from '../utils/cooldown.js';

describe('Cooldown', () => {
  const userId = '123456789';
  const action = 'test_action';

  beforeEach(() => {
    const _buckets = new Map();
  });

  it('allows first request', () => {
    expect(checkCooldown(userId, action, 5000)).toBe(true);
  });

  it('blocks second request within window', () => {
    checkCooldown(userId, action, 5000);
    expect(checkCooldown(userId, action, 5000)).toBe(false);
  });

  it('allows request after window expires', async () => {
    checkCooldown('timing_user', 'timing_action', 5);
    await new Promise(r => setTimeout(r, 30));
    expect(checkCooldown('timing_user', 'timing_action', 5)).toBe(true);
  });

  it('tracks different actions independently', () => {
    checkCooldown(userId, 'action_a', 5000);
    expect(checkCooldown(userId, 'action_b', 5000)).toBe(true);
    expect(checkCooldown(userId, 'action_a', 5000)).toBe(false);
  });

  it('tracks different users independently', () => {
    checkCooldown('user1', action, 5000);
    expect(checkCooldown('user2', action, 5000)).toBe(true);
    expect(checkCooldown('user1', action, 5000)).toBe(false);
  });
});
