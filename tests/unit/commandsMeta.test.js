// tests/unit/commandsMeta.test.js
// Test: central registry utils/commands.js consistency.
// Chỉ giữ 2 commands cơ bản: /help, /setup. Mọi thao tác khác qua UI.

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
    expect(getCmd('help').desc).toMatch(/hướng dẫn/i);
    expect(getCmd('khong-co')).toBeUndefined();
  });

  it('byCategory trả về mảng con', () => {
    const tienIch = byCategory('TIEN_ICH');
    expect(tienIch.length).toBeGreaterThan(0);
    expect(tienIch.every(c => c.category === 'TIEN_ICH')).toBe(true);
  });

  it('admin commands core đều có mặt', () => {
    const adminNames = byAudience('admin').map(c => c.name);
    expect(adminNames).toContain('setup');
  });

  it('user commands phổ biến đều có mặt', () => {
    const userNames = byAudience('user').map(c => c.name);
    expect(userNames).toContain('help');
  });

  it('đúng 2 commands (help, setup)', () => {
    expect(COMMANDS).toHaveLength(2);
  });
});
