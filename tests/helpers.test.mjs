import { describe, it, expect } from 'vitest';
import { buildRichProgressBar, pctEmoji, pctLabel, formatDuration } from '../utils/_helpers.js';

describe('buildRichProgressBar', () => {
  it('returns 12 visible characters at 50%', () => {
    const bar = buildRichProgressBar(50);
    const visible = [...bar].length;
    expect(visible).toBe(12);
  });

  it('uses 💎 at 100%', () => {
    const visible = [...buildRichProgressBar(100)];
    expect(visible.every(c => c === '💎')).toBe(true);
    expect(visible.length).toBe(12);
  });

  it('uses all ⬜ at 0%', () => {
    const visible = [...buildRichProgressBar(0)];
    expect(visible.every(c => c === '⬜')).toBe(true);
    expect(visible.length).toBe(12);
  });

  it('uses 5-tier emojis by threshold', () => {
    expect(buildRichProgressBar(20)).toContain('🔴');
    expect(buildRichProgressBar(40)).toContain('🟠');
    expect(buildRichProgressBar(60)).toContain('🟡');
    expect(buildRichProgressBar(80)).toContain('🟩');
    expect(buildRichProgressBar(95)).toContain('💎');
  });

  it('respects custom length', () => {
    const visible = [...buildRichProgressBar(50, 5)];
    expect(visible.length).toBe(5);
  });

  it('filled count matches percentage', () => {
    const bar30 = [...buildRichProgressBar(30, 10)];
    const filled30 = bar30.filter(c => c !== '⬜').length;
    expect(filled30).toBe(3);

    const bar70 = [...buildRichProgressBar(70, 10)];
    const filled70 = bar70.filter(c => c !== '⬜').length;
    expect(filled70).toBe(7);
  });
});

describe('pctEmoji', () => {
  it('returns correct emoji for tier', () => {
    expect(pctEmoji(20)).toBe('📉');
    expect(pctEmoji(40)).toBe('🥉');
    expect(pctEmoji(60)).toBe('🥈');
    expect(pctEmoji(80)).toBe('🥇');
    expect(pctEmoji(95)).toBe('🏆');
  });
});

describe('pctLabel', () => {
  it('returns matching label', () => {
    expect(pctLabel(20)).toBe('Cần cải thiện');
    expect(pctLabel(50)).toBe('Trung bình');
    expect(pctLabel(75)).toBe('Tốt');
    expect(pctLabel(90)).toBe('Xuất sắc');
  });
});

describe('formatDuration', () => {
  it('returns 0p for < 60s', () => {
    expect(formatDuration(45)).toBe('0p');
  });

  it('formats minutes-only', () => {
    expect(formatDuration(125)).toBe('2p');
  });

  it('formats hours+minutes', () => {
    expect(formatDuration(3661)).toBe('1g 1p');
  });

  it('returns 0p for 0 seconds', () => {
    expect(formatDuration(0)).toBe('0p');
  });
});
