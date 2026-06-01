import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { msFromOpenToClose, msToCloseFromNow, msToNextWeekday } from '../utils/timeCalc.js';

// ─── msFromOpenToClose ────────────────────────────────────────────────────────────
const MS_1H  = 60 * 60 * 1000;
const MS_7D  = 7 * 24 * MS_1H;
const MS_24H = 24 * MS_1H;

describe('msFromOpenToClose', () => {
  it('cùng ngày open < close → đúng giờ', () => {
    expect(msFromOpenToClose(6, 20, 0, 6, 22, 0)).toBe(2 * MS_1H);
  });

  it('close === open → +7 ngày (không bao giờ 0)', () => {
    expect(msFromOpenToClose(6, 20, 0, 6, 20, 0)).toBe(MS_7D);
  });

  it('close < open trong ngày (wrap qua midnight) → dương', () => {
    // T7 22:00 → CN 02:00 = 4h
    const ms = msFromOpenToClose(6, 22, 0, 0, 2, 0);
    expect(ms).toBe(4 * MS_1H);
  });

  it('T7 mở → T7 tuần sau đóng (close === open) = chính xác 7 ngày', () => {
    expect(msFromOpenToClose(6, 20, 0, 6, 20, 0)).toBe(MS_7D);
  });

  it('close ở ngày nhỏ hơn trong tuần (T7 → T2) → dương', () => {
    // T7=6, close T2=1: (1+7-6)*24*60 + (8-22)*60 phút
    const ms = msFromOpenToClose(6, 22, 0, 1, 8, 0);
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBe(((1 + 7 - 6) * MS_24H) + ((8 - 22) * MS_1H));
  });

  it('luôn dương với mọi đầu vào hợp lệ', () => {
    const cases = [
      [0,0,0,6,23,59], [3,12,0,3,12,0], [5,8,0,1,9,0], [1,0,0,0,23,59], [6,23,59,0,0,0]
    ];
    for (const [od,oh,om,cd,ch,cm] of cases) {
      expect(msFromOpenToClose(od,oh,om,cd,ch,cm)).toBeGreaterThan(0);
    }
  });

  it('T6 23:59 → T7 00:00 = 1 phút', () => {
    expect(msFromOpenToClose(5, 23, 59, 6, 0, 0)).toBe(60_000);
  });

  it('không bao giờ vượt 14 ngày', () => {
    const cases = [[0,0,0,6,23,59], [6,0,0,0,0,0], [3,12,0,3,11,59]];
    for (const [od,oh,om,cd,ch,cm] of cases) {
      expect(msFromOpenToClose(od,oh,om,cd,ch,cm)).toBeLessThanOrEqual(MS_7D);
    }
  });
});

// ─── msToCloseFromNow ───────────────────────────────────────────────────────────
describe('msToCloseFromNow', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('null khi createdAt = null', () => {
    expect(msToCloseFromNow(6,20,0,6,22,0,null)).toBeNull();
  });
  it('null khi createdAt = chuỗi rộng', () => {
    expect(msToCloseFromNow(6,20,0,6,22,0,'')).toBeNull();
  });
  it('null khi createdAt = chuỗi không phải date', () => {
    expect(msToCloseFromNow(6,20,0,6,22,0,'invalid-date')).toBeNull();
  });

  it('giá trị âm nếu đã qua giờ đóng', () => {
    const openedAt = new Date('2026-05-30T13:00:00Z').toISOString();
    vi.setSystemTime(new Date('2026-05-30T16:00:00Z')); // +3h sau mở
    // duration = 2h, nhưng đã qua 3h → âm
    const ms = msToCloseFromNow(6,20,0,6,22,0, openedAt);
    expect(ms).toBeLessThan(0);
  });

  it('giá trị dương nếu chưa đến giờ đóng', () => {
    const openedAt = new Date('2026-05-30T13:00:00Z').toISOString();
    vi.setSystemTime(new Date('2026-05-30T14:00:00Z')); // +1h
    const ms = msToCloseFromNow(6,20,0,6,22,0, openedAt);
    expect(ms).toBeGreaterThan(0);
  });

  it('chính xác: mở lúc T=0, kiểm tra tại T+1h, close sau 2h → còn 1h', () => {
    const openedAt = new Date('2026-01-01T10:00:00Z').toISOString();
    vi.setSystemTime(new Date('2026-01-01T11:00:00Z'));
    const ms = msToCloseFromNow(6,20,0,6,22,0, openedAt);
    // Expected: (openedAt + 2h) - now = 1h
    expect(Math.round(ms / MS_1H)).toBe(1);
  });
});

// ─── msToNextWeekday ─────────────────────────────────────────────────────────────
describe('msToNextWeekday', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // UTC+7: đặt system time UTC sàng T7 (6) 13:00 VN = UTC 06:00
  it('cùng ngày nhưng giờ chưa tới → dương nhỏ hơn 24h', () => {
    vi.setSystemTime(new Date('2026-05-30T06:00:00Z')); // T7, 13:00 VN
    const ms = msToNextWeekday(6, 20, 0); // T7 20:00 VN, còn 7h
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThan(MS_24H);
  });

  it('cùng ngày nhưng giờ đã qua → đi tuần sau (> 6 ngày)', () => {
    vi.setSystemTime(new Date('2026-05-30T15:00:00Z')); // T7, 22:00 VN
    const ms = msToNextWeekday(6, 20, 0); // T7 20:00 VN đã qua
    expect(ms).toBeGreaterThan(6 * MS_24H);
    expect(ms).toBeLessThanOrEqual(MS_7D);
  });

  it('luôn trả về dương', () => {
    vi.setSystemTime(new Date('2026-05-30T00:00:00Z'));
    for (let day = 0; day <= 6; day++) {
      for (const [h, m] of [[0,0],[12,0],[23,59]]) {
        expect(msToNextWeekday(day, h, m)).toBeGreaterThan(0);
      }
    }
  });

  it('đúng giờ đủng từng giây → đi tuần sau (pastOrEqual khi s > 0)', () => {
    // VN 20:00:01 = UTC 13:00:01
    vi.setSystemTime(new Date('2026-05-30T13:00:01Z'));
    const ms = msToNextWeekday(6, 20, 0);
    expect(ms).toBeGreaterThan(6 * MS_24H);
  });
});
