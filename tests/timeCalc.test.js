import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { msFromOpenToClose, msToCloseFromNow } from '../utils/timeCalc.js';

describe('msFromOpenToClose', () => {
  it('cùng ngày, đóng sau mở', () => {
    // T7 20:00 → T7 22:00 = 2 giờ
    const ms = msFromOpenToClose(6, 20, 0, 6, 22, 0);
    expect(ms).toBe(2 * 60 * 60 * 1000);
  });

  it('close = open → thêm 7 ngày', () => {
    const ms = msFromOpenToClose(6, 20, 0, 6, 20, 0);
    expect(ms).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('close < open trong tuần → thêm 7 ngày (wrap)', () => {
    // T7 22:00 → T2 08:00: T2(1) < T7(6) → +7 ngày
    const ms = msFromOpenToClose(6, 22, 0, 1, 8, 0);
    const expected = ((1 + 7 - 6) * 24 * 60 + (8 - 22) * 60) * 60 * 1000;
    expect(ms).toBe(expected);
    expect(ms).toBeGreaterThan(0);
  });

  it('T7 → T7 tuần sau (7 ngày đúng)', () => {
    // Mở T7 20:00, đóng T7 20:00 → 7 ngày
    const ms = msFromOpenToClose(6, 20, 0, 6, 20, 0);
    expect(ms).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe('msToCloseFromNow', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('trả về null nếu createdAt không hợp lệ', () => {
    const r = msToCloseFromNow(6, 20, 0, 6, 22, 0, 'invalid-date');
    expect(r).toBeNull();
  });

  it('trả về âm nếu đã qua giờ đóng', () => {
    const openedAt = new Date('2026-05-30T13:00:00Z').toISOString(); // T7 20:00 VN
    vi.setSystemTime(new Date('2026-05-30T16:00:00Z')); // T7 23:00 VN — sau 22:00
    const r = msToCloseFromNow(6, 20, 0, 6, 22, 0, openedAt);
    expect(r).toBeLessThan(0);
  });

  it('trả về dương nếu chưa đến giờ đóng', () => {
    const openedAt = new Date('2026-05-30T13:00:00Z').toISOString(); // T7 20:00 VN
    vi.setSystemTime(new Date('2026-05-30T14:00:00Z')); // T7 21:00 VN — trước 22:00
    const r = msToCloseFromNow(6, 20, 0, 6, 22, 0, openedAt);
    expect(r).toBeGreaterThan(0);
  });
});
