// tests/unit/schedulerPreClose.test.js
// Test cho helper msToPreCloseFromNow() trong utils/scheduler.js
// (Commit 2: auto-close 30 phút trước giờ mở)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

function mockModule(modulePath, exports) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved, filename: resolved, loaded: true,
    exports, children: [], paths: [],
  };
}

// Mock logger + timeCalc (chỉ dùng msToNextWeekday)
const msToNextWeekday = vi.fn();
mockModule('../../utils/logger.js', {
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
});
mockModule('../../utils/timeCalc.js', {
  msToNextWeekday:        (...a) => msToNextWeekday(...a),
  msFromOpenToClose:      vi.fn(),
  msToCloseFromNow:       vi.fn(),
});

// Mock db + embeds + session — scheduler cần require chúng
mockModule('../../db.js', {
  getActiveSession: vi.fn(), createSession: vi.fn(), closeSession: vi.fn(),
  updateSessionMessage: vi.fn(),
});
mockModule('../../utils/embeds.js', {
  buildAttendanceButtons: vi.fn(), buildSummaryEmbed: vi.fn(),
  buildClosedSessionEmbed: vi.fn(), buildSessionEmbed: vi.fn(),
});
mockModule('../../utils/session.js', {
  ketThucPhien: vi.fn(), thongBaoHuyHieu: vi.fn(), guiCsvDinhKem: vi.fn(),
});

const { msToPreCloseFromNow } = require('../../utils/scheduler.js');

describe('msToPreCloseFromNow (Commit 2)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => msToNextWeekday.mockReset());

  it('pre_close_minutes = 0 → trả null (không có pre-close)', () => {
    const result = msToPreCloseFromNow({ day_of_week: 6, hour: 20, minute: 0, pre_close_minutes: 0 });
    expect(result).toBeNull();
  });

  it('pre_close_minutes không có → trả null (default 30 nhưng check field falsy)', () => {
    const result = msToPreCloseFromNow({ day_of_week: 6, hour: 20, minute: 0 });
    // Helper: chỉ return non-null nếu lich.pre_close_minutes > 0
    expect(result).toBeNull();
  });

  it('thiếu day_of_week → null', () => {
    const result = msToPreCloseFromNow({ hour: 20, minute: 0, pre_close_minutes: 30 });
    expect(result).toBeNull();
  });

  it('tính msOpen = 60 phút từ bây giờ, pre_close=30 → msRemaining = 30 phút', () => {
    msToNextWeekday.mockReturnValue(60 * 60_000);
    const result = msToPreCloseFromNow({ day_of_week: 6, hour: 20, minute: 0, pre_close_minutes: 30 });
    expect(result).toBe(30 * 60_000);
  });

  it('msPreClose đã qua (âm) → null', () => {
    // msOpen = 10 phút từ bây giờ, pre_close=30 → msPreClose = -20 phút
    msToNextWeekday.mockReturnValue(10 * 60_000);
    const result = msToPreCloseFromNow({ day_of_week: 6, hour: 20, minute: 0, pre_close_minutes: 30 });
    expect(result).toBeNull();
  });

  it('pre_close lớn (60p) với msOpen=90p → remaining=30p', () => {
    msToNextWeekday.mockReturnValue(90 * 60_000);
    const result = msToPreCloseFromNow({ day_of_week: 6, hour: 20, minute: 0, pre_close_minutes: 60 });
    expect(result).toBe(30 * 60_000);
  });

  it('lich null → null', () => {
    expect(msToPreCloseFromNow(null)).toBeNull();
  });
});
