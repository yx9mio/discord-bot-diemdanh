// tests/unit/validate.test.js
// Test Zod schemas + safeParse — pure logic, không cần mock
import { describe, it, expect } from 'vitest';

const {
  LichSchema, SessionSchema, AttendanceSchema, ConfigSchema,
  BatDauInputSchema, safeParse,
} = await import('../../utils/validate.js');

// ─── safeParse ────────────────────────────────────────────────────────────────
describe('safeParse', () => {
  it('ok: true + data khi hợp lệ', () => {
    const result = safeParse(ConfigSchema, { guild_id: 'g1' });
    expect(result.ok).toBe(true);
    expect(result.data.guild_id).toBe('g1');
  });

  it('ok: false + error string khi thiếu field bắt buộc', () => {
    const result = safeParse(ConfigSchema, {});
    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe('string');
    expect(result.error.length).toBeGreaterThan(0);
  });
});

// ─── LichSchema ──────────────────────────────────────────────────────────────
describe('LichSchema', () => {
  const base = {
    id: '00000000-0000-0000-0000-000000000001',
    guild_id: 'g1',
    channel_id: 'c1',
    session_name: 'Họp tuần',
    day_of_week: 1,
    hour: 20,
    minute: 0,
  };

  it('hợp lệ với data tối thiểu', () => {
    expect(safeParse(LichSchema, base).ok).toBe(true);
  });

  it('lỗi khi day_of_week > 6', () => {
    expect(safeParse(LichSchema, { ...base, day_of_week: 7 }).ok).toBe(false);
  });

  it('lỗi khi day_of_week < 0', () => {
    expect(safeParse(LichSchema, { ...base, day_of_week: -1 }).ok).toBe(false);
  });

  it('lỗi khi hour > 23', () => {
    expect(safeParse(LichSchema, { ...base, hour: 24 }).ok).toBe(false);
  });

  it('lỗi khi minute > 59', () => {
    expect(safeParse(LichSchema, { ...base, minute: 60 }).ok).toBe(false);
  });

  it('lỗi khi session_name rỗng', () => {
    expect(safeParse(LichSchema, { ...base, session_name: '' }).ok).toBe(false);
  });

  it('lỗi khi session_name > 100 ký tự', () => {
    expect(safeParse(LichSchema, { ...base, session_name: 'x'.repeat(101) }).ok).toBe(false);
  });

  it('optional fields nullable OK', () => {
    const r = safeParse(LichSchema, {
      ...base,
      close_day_of_week: null,
      close_hour: null,
      close_minute: null,
      allowed_role_id: null,
      phai_role_ids: null,
    });
    expect(r.ok).toBe(true);
  });

  it('phai_role_ids là mảng string OK', () => {
    const r = safeParse(LichSchema, { ...base, phai_role_ids: ['r1', 'r2'] });
    expect(r.ok).toBe(true);
  });
});

// ─── SessionSchema ────────────────────────────────────────────────────────────
describe('SessionSchema', () => {
  const base = {
    id: '00000000-0000-0000-0000-000000000001',
    guild_id: 'g1',
    session_name: 'Phiên test',
    started_by: 'u1',
    is_active: true,
  };

  it('hợp lệ với data tối thiểu', () => {
    expect(safeParse(SessionSchema, base).ok).toBe(true);
  });

  it('lỗi khi id không phải UUID', () => {
    expect(safeParse(SessionSchema, { ...base, id: 'not-uuid' }).ok).toBe(false);
  });

  it('lỗi khi is_active không phải boolean', () => {
    expect(safeParse(SessionSchema, { ...base, is_active: 'true' }).ok).toBe(false);
  });

  it('eligible_member_ids là mảng OK', () => {
    const r = safeParse(SessionSchema, { ...base, eligible_member_ids: ['u1', 'u2'] });
    expect(r.ok).toBe(true);
  });

  it('cancelled default false', () => {
    const r = safeParse(SessionSchema, base);
    expect(r.data.cancelled).toBe(false);
  });
});

// ─── AttendanceSchema ────────────────────────────────────────────────────────
describe('AttendanceSchema', () => {
  const base = {
    session_id: '00000000-0000-0000-0000-000000000002',
    user_id: 'u1',
  };

  it('hợp lệ với data tối thiểu', () => {
    expect(safeParse(AttendanceSchema, base).ok).toBe(true);
  });

  it('lỗi khi status không hợp lệ', () => {
    expect(safeParse(AttendanceSchema, { ...base, status: 'nghi_phep' }).ok).toBe(false);
  });

  it('các status hợp lệ đều pass', () => {
    for (const s of ['tham_gia', 'tre', 'khong_tham_gia', 'co_phep']) {
      expect(safeParse(AttendanceSchema, { ...base, status: s }).ok).toBe(true);
    }
  });

  it('session_id không phải UUID → lỗi', () => {
    expect(safeParse(AttendanceSchema, { ...base, session_id: 'bad' }).ok).toBe(false);
  });
});

// ─── BatDauInputSchema ────────────────────────────────────────────────────────
describe('BatDauInputSchema', () => {
  it('hợp lệ với session_name', () => {
    expect(safeParse(BatDauInputSchema, { session_name: 'Họp hàng tuần' }).ok).toBe(true);
  });

  it('lỗi khi session_name rỗng', () => {
    expect(safeParse(BatDauInputSchema, { session_name: '' }).ok).toBe(false);
  });

  it('lỗi khi thiếu session_name', () => {
    expect(safeParse(BatDauInputSchema, {}).ok).toBe(false);
  });

  it('lỗi khi session_name > 100 ký tự', () => {
    expect(safeParse(BatDauInputSchema, { session_name: 'a'.repeat(101) }).ok).toBe(false);
  });
});