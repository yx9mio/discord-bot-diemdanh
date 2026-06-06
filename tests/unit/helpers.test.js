// tests/unit/helpers.test.js
// [Phase-E] Unit tests for utils/_helpers.js
import { describe, it, expect } from 'vitest';
import {
  pctColor, pctLabel, pctEmoji,
  buildRichProgressBar,
  formatDuration,
  chunkLines,
  replyErr, replyOk, replyOkEdit, replyErrEdit, replyLoading,
  COLORS, ICONS, ATTENDANCE_OPTIONS,
} from '../../utils/_helpers.js';

describe('pctColor', () => {
  it('returns GREEN when pct >= 80', () => expect(pctColor(80)).toBe(COLORS.GREEN));
  it('returns ORANGE when 50 <= pct < 80', () => expect(pctColor(65)).toBe(COLORS.ORANGE));
  it('returns RED when pct < 50', () => expect(pctColor(30)).toBe(COLORS.RED));
});

describe('pctLabel', () => {
  it('xuất sắc khi >= 90', () => expect(pctLabel(95)).toBe('Xuất sắc'));
  it('tốt khi 75-89', () => expect(pctLabel(80)).toBe('Tốt'));
  it('trung bình khi 50-74', () => expect(pctLabel(60)).toBe('Trung bình'));
  it('cần cải thiện khi < 50', () => expect(pctLabel(20)).toBe('Cần cải thiện'));
});

describe('pctEmoji', () => {
  it('trả về 🏆 khi >= 90', () => expect(pctEmoji(90)).toBe('🏆'));
  it('trả về 📉 khi < 40', () => expect(pctEmoji(10)).toBe('📉'));
});

describe('buildRichProgressBar', () => {
  it('full bar khi pct = 100', () => {
    const bar = buildRichProgressBar(100, 10);
    expect(bar).toBe('█'.repeat(10));
  });
  it('empty bar khi pct = 0', () => {
    const bar = buildRichProgressBar(0, 10);
    expect(bar).toBe('░'.repeat(10));
  });
  it('50% = 6 █ + 6 ░ (len = 12 default)', () => {
    const bar = buildRichProgressBar(50);
    expect(bar).toBe('█'.repeat(6) + '░'.repeat(6));
  });
});

describe('formatDuration', () => {
  it('hiển thị phút khi < 1 giờ', () => expect(formatDuration(90)).toBe('1p'));
  it('hiển thị giờ + phút', () => expect(formatDuration(3660)).toBe('1g 1p'));
  it('hiển thị 0p khi 0 giây', () => expect(formatDuration(0)).toBe('0p'));
});

describe('chunkLines', () => {
  it('không split nếu tổng <= maxLen', () => {
    const lines = ['abc', 'def', 'ghi'];
    const chunks = chunkLines(lines, 1020);
    expect(chunks).toHaveLength(1);
  });
  it('split khi vượt maxLen', () => {
    const lines = Array(50).fill('x'.repeat(30));
    const chunks = chunkLines(lines, 100);
    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe('ICONS', () => {
  it('có REFRESH', () => expect(ICONS.REFRESH).toBeTruthy());
  it('có HOME', () => expect(ICONS.HOME).toBeTruthy());
  it('có SESSION_OPEN/CLOSED', () => {
    expect(ICONS.SESSION_OPEN).toBeTruthy();
    expect(ICONS.SESSION_CLOSED).toBeTruthy();
  });
});

describe('ATTENDANCE_OPTIONS', () => {
  it('có 4 options', () => expect(ATTENDANCE_OPTIONS).toHaveLength(4));
  it('values không trùng nhau', () => {
    const vals = ATTENDANCE_OPTIONS.map(o => o.value);
    expect(new Set(vals).size).toBe(4);
  });
});

describe('reply helpers', () => {
  it('replyErr trả về embeds + Ephemeral', () => {
    const r = replyErr('test error');
    expect(r.embeds).toHaveLength(1);
    expect(r.flags).toBeDefined();
  });
  it('replyOk trả về embeds + Ephemeral', () => {
    const r = replyOk();
    expect(r.embeds).toHaveLength(1);
    expect(r.flags).toBeDefined();
  });
  it('replyOkEdit không có flags, có components: []', () => {
    const r = replyOkEdit();
    expect(r.components).toEqual([]);
    expect(r.flags).toBeUndefined();
  });
  it('replyErrEdit không có flags, có components: []', () => {
    const r = replyErrEdit();
    expect(r.components).toEqual([]);
  });
  it('replyLoading trả về embeds BLUE', () => {
    const r = replyLoading('loading...');
    expect(r.embeds).toHaveLength(1);
  });
});
