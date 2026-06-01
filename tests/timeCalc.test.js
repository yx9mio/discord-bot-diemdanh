import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { msFromOpenToClose, msToCloseFromNow } from '../utils/timeCalc.js';

describe('msFromOpenToClose', () => {
  it('cùng ngày, đóng sau mở', () => {
    expect(msFromOpenToClose(6, 20, 0, 6, 22, 0)).toBe(2 * 60 * 60 * 1000);
  });
  it('close = open → thêm 7 ngày', () => {
    expect(msFromOpenToClose(6, 20, 0, 6, 20, 0)).toBe(7 * 24 * 60 * 60 * 1000);
  });
  it('close < open trong tuần → wrap +7 ngày', () => {
    const ms = msFromOpenToClose(6, 22, 0, 1, 8, 0);
    expect(ms).toBeGreaterThan(0);
    // T7→T2: (1+7-6)*24*60 + (8-22)*60 phút
    expect(ms).toBe(((1 + 7 - 6) * 24 * 60 + (8 - 22) * 60) * 60 * 1000);
  });
  it('T7 mở → T7 tuần sau đóng = 7 ngày chính xác', () => {
    expect(msFromOpenToClose(6, 20, 0, 6, 20, 0)).toBe(7 * 24 * 60 * 60 * 1000);
  });
  it('luôn trả về số dương', () => {
    for (const [od, oh, om, cd, ch, cm] of [
      [0,0,0,6,23,59], [3,12,0,3,12,0], [5,8,0,1,9,0]
    ]) {
      expect(msFromOpenToClose(od,oh,om,cd,ch,cm)).toBeGreaterThan(0);
    }
  });
});

describe('msToCloseFromNow', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('trả về null nếu createdAt không hợp lệ', () => {
    expect(msToCloseFromNow(6,20,0,6,22,0,'invalid')).toBeNull();
  });
  it('trả về âm nếu đã qua giờ đóng', () => {
    const openedAt = new Date('2026-05-30T13:00:00Z').toISOString();
    vi.setSystemTime(new Date('2026-05-30T16:00:00Z'));
    expect(msToCloseFromNow(6,20,0,6,22,0,openedAt)).toBeLessThan(0);
  });
  it('trả về dương nếu chưa đến giờ đóng', () => {
    const openedAt = new Date('2026-05-30T13:00:00Z').toISOString();
    vi.setSystemTime(new Date('2026-05-30T14:00:00Z'));
    expect(msToCloseFromNow(6,20,0,6,22,0,openedAt)).toBeGreaterThan(0);
  });
});
