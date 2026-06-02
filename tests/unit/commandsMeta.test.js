// tests/unit/commandsMeta.test.js
// Test: central registry utils/commands.js consistency.

import { describe, it, expect } from 'vitest';
const {
  CATEGORIES, AUDIENCES, COMMANDS, getCmd, byAudience, byCategory,
} = await import('../../utils/commands.js');

describe('utils/commands.js (registry)', () => {
  it('mọi command có đủ trường bắt buộc', () => {
    for (const c of COMMANDS) {
      expect(c.name).toBeTypeOf('string');
      expect(c.desc).toBeTypeOf('string');
      expect(['user', 'admin']).toContain(c.audience);
      expect(CATEGORIES[c.category]).toBeTruthy();
      expect(c.ephemeral).toBeTypeOf('boolean');
    }
  });

  it('không có tên command trùng', () => {
    const names = COMMANDS.map(c => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('tất cả audience đều nằm trong AUDIENCES', () => {
    const audiences = new Set(COMMANDS.map(c => c.audience));
    for (const a of audiences) expect(AUDIENCES[a.toUpperCase()]).toBeTruthy();
  });

  it('byAudience partition đúng số lượng', () => {
    const users  = byAudience('user');
    const admins = byAudience('admin');
    expect(users.length + admins.length).toBe(COMMANDS.length);
    expect(users.length).toBeGreaterThan(0);
    expect(admins.length).toBeGreaterThan(0);
  });

  it('getCmd(name) tìm đúng command', () => {
    expect(getCmd('diemdanh').desc).toMatch(/điểm danh/i);
    expect(getCmd('khong-co')).toBeUndefined();
  });

  it('byCategory trả về mảng con', () => {
    const phien = byCategory('PHIEN');
    expect(phien.length).toBeGreaterThan(0);
    expect(phien.every(c => c.category === 'PHIEN')).toBe(true);
  });

  it('admin commands đều nằm trong danh sách rõ ràng', () => {
    const adminNames = byAudience('admin').map(c => c.name);
    expect(adminNames).toContain('bat_dau');
    expect(adminNames).toContain('ket_thuc');
    expect(adminNames).toContain('caidat');
  });

  it('user commands phổ biến đều nằm trong user audience', () => {
    const userNames = byAudience('user').map(c => c.name);
    expect(userNames).toContain('diemdanh');
    expect(userNames).toContain('toi');
    expect(userNames).toContain('rank');
    expect(userNames).toContain('help');
  });
});
