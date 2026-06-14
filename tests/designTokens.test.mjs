import { describe, it, expect } from 'vitest';
import { STATUS_CONFIG, statusFull, ATTENDANCE_OPTIONS } from '../utils/design-tokens.js';

describe('STATUS_CONFIG', () => {
  const expectedKeys = ['tham_gia', 'tre', 'khong_tham_gia', 'co_phep'];

  for (const key of expectedKeys) {
    it(`has ${key} with required fields`, () => {
      const cfg = STATUS_CONFIG[key];
      expect(cfg).toBeDefined();
      expect(typeof cfg.label).toBe('string');
      expect(typeof cfg.shortLabel).toBe('string');
      expect(typeof cfg.emoji).toBe('string');
      expect(typeof cfg.color).toBe('number');
    });
  }
});

describe('statusFull', () => {
  it('returns emoji + label for valid status', () => {
    const result = statusFull('tham_gia');
    expect(result).toMatch(/✅/);
    expect(result).toMatch(/Tham gia/);
  });

  it('returns prefixed status for unknown', () => {
    const result = statusFull('unknown');
    expect(result).toBe('❓ unknown');
  });
});

describe('ATTENDANCE_OPTIONS', () => {
  it('has 4 options', () => {
    expect(ATTENDANCE_OPTIONS.length).toBe(4);
  });

  it('each option has value and label', () => {
    for (const opt of ATTENDANCE_OPTIONS) {
      expect(opt).toHaveProperty('value');
      expect(opt).toHaveProperty('label');
    }
  });
});
