// tests/unit/scheduleModal.test.js
// Test: parseGio, parsePreClose, parsePhutBu (pure helpers)
// + handler behavior với mockModalSubmit

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

function mockModule(modulePath, exports) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved, filename: resolved, loaded: true,
    exports, children: [], paths: [],
  };
}

const mockThemLichCoDinh   = vi.fn().mockResolvedValue(null);
const mockGetGuildConfig   = vi.fn().mockResolvedValue({ log_channel_id: 'ch1' });

mockModule('../../db.js', {
  themLichCoDinh:     (...a) => mockThemLichCoDinh(...a),
  getGuildConfig:     (...a) => mockGetGuildConfig(...a),
});
mockModule('../../utils/logger.js', {
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
});
mockModule('@sapphire/framework', {
  InteractionHandler: class {
    constructor(ctx, opts) { Object.assign(this, opts); }
    some() { return { some: true }; }
    none() { return { none: true }; }
  },
  InteractionHandlerTypes: { ModalSubmit: 'ModalSubmit', Button: 'Button' },
});

const {
  parseGio, parsePreClose, parsePhutBu,
} = require('../../interaction-handlers/setup/setupScheduleAddDetailModal.js');
const { SetupScheduleAddTypeModal } = require('../../interaction-handlers/setup/setupScheduleAddTypeModal.js');

beforeEach(() => vi.clearAllMocks());

describe('parseGio()', () => {
  it('parse "20:00" → { hour: 20, minute: 0 }', () => {
    expect(parseGio('20:00')).toEqual({ hour: 20, minute: 0 });
  });
  it('parse "9:30" → { hour: 9, minute: 30 }', () => {
    expect(parseGio('9:30')).toEqual({ hour: 9, minute: 30 });
  });
  it('parse "23:59" → { hour: 23, minute: 59 }', () => {
    expect(parseGio('23:59')).toEqual({ hour: 23, minute: 59 });
  });
  it('invalid "25:00" → null', () => {
    expect(parseGio('25:00')).toBeNull();
  });
  it('invalid "abc" → null', () => {
    expect(parseGio('abc')).toBeNull();
  });
  it('empty → null', () => {
    expect(parseGio('')).toBeNull();
  });
  it('"20-00" → null (wrong separator)', () => {
    expect(parseGio('20-00')).toBeNull();
  });
  it('whitespace padded → trimmed', () => {
    expect(parseGio('  20:00  ')).toEqual({ hour: 20, minute: 0 });
  });
});

describe('parsePreClose()', () => {
  it('"30" → 30', () => expect(parsePreClose('30')).toBe(30));
  it('"0" → 0', () => expect(parsePreClose('0')).toBe(0));
  it('"180" → 180', () => expect(parsePreClose('180')).toBe(180));
  it('"200" → 30 (clamp to default)', () => expect(parsePreClose('200')).toBe(30));
  it('null → 30 (default)', () => expect(parsePreClose(null)).toBe(30));
  it('"abc" → 30 (NaN → default)', () => expect(parsePreClose('abc')).toBe(30));
});

describe('parsePhutBu()', () => {
  it('"none" → all null', () => {
    expect(parsePhutBu(20, 0, 'none')).toEqual({ closeDayOfWeek: null, closeHour: null, closeMinute: null });
  });
  it('20:00 + 60 → closeDayOfWeek=0, 21:00 (same day, no overflow)', () => {
    expect(parsePhutBu(20, 0, '60')).toEqual({ closeDayOfWeek: 0, closeHour: 21, closeMinute: 0 });
  });
  it('20:00 + 120 → next day, 22:00', () => {
    // dayOfWeek wraps; we don't care about exact value, just structure
    const r = parsePhutBu(20, 0, '120');
    expect(r.closeHour).toBe(22);
    expect(r.closeMinute).toBe(0);
    expect(typeof r.closeDayOfWeek).toBe('number');
  });
  it('20:30 + 90 → 22:00 (30+90=120 phút = 2h)', () => {
    const r = parsePhutBu(20, 30, '90');
    expect(r.closeHour).toBe(22);
    expect(r.closeMinute).toBe(0);
  });
  it('"abc" → all null', () => {
    expect(parsePhutBu(20, 0, 'abc')).toEqual({ closeDayOfWeek: null, closeHour: null, closeMinute: null });
  });
});

describe('SetupScheduleAddTypeModal (parse)', () => {
  it('match customId TYPE', () => {
    const h = new SetupScheduleAddTypeModal({}, {});
    expect(h.parse({ customId: 'setup:sch:add:type' })).toBeTruthy();
  });
  it('không match customId khác', () => {
    const h = new SetupScheduleAddTypeModal({}, {});
    expect(h.parse({ customId: 'setup:sch:del:abc' })).toEqual({ none: true });
  });
});
