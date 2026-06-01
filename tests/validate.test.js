import { describe, it, expect } from 'vitest';
import {
  LichSchema, SessionSchema, AttendanceSchema,
  ConfigSchema, BatDauInputSchema, safeParse
} from '../utils/validate.js';

// ─── safeParse helper ────────────────────────────────────────────────────────────
describe('safeParse helper', () => {
  it('trả về { ok: true, data } khi hợp lệ', () => {
    const r = safeParse(LichSchema, {
      id: '00000000-0000-0000-0000-000000000001',
      guild_id: 'g1', channel_id: 'c1', session_name: 'Test',
      day_of_week: 6, hour: 20, minute: 0,
    });
    expect(r.ok).toBe(true);
    expect(r.data).toBeDefined();
  });
  it('trả về { ok: false, error } khi không hợp lệ', () => {
    const r = safeParse(LichSchema, {});
    expect(r.ok).toBe(false);
    expect(typeof r.error).toBe('string');
    expect(r.error.length).toBeGreaterThan(0);
  });
  it('error message chứa tên field', () => {
    const r = safeParse(LichSchema, { day_of_week: 99 });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/guild_id|id|session_name|day_of_week/);
  });
});

// ─── LichSchema ──────────────────────────────────────────────────────────────────
const baseLich = {
  id: '00000000-0000-0000-0000-000000000001',
  guild_id: '123456789', channel_id: '987654321',
  session_name: 'Điểm danh tuần', day_of_week: 6, hour: 20, minute: 0,
};

describe('LichSchema', () => {
  it('hợp lệ tối thiểu', () => expect(safeParse(LichSchema, baseLich).ok).toBe(true));
  it('hợp lệ đầy đủ các trường optional', () => {
    const r = safeParse(LichSchema, {
      ...baseLich,
      close_day_of_week: 6, close_hour: 22, close_minute: 0,
      allowed_role_id: 'role1', phai_role_ids: ['r1','r2'], is_active: true,
    });
    expect(r.ok).toBe(true);
  });

  it.each([0,1,2,3,4,5,6])('day_of_week=%i hợp lệ', d =>
    expect(safeParse(LichSchema, { ...baseLich, day_of_week: d }).ok).toBe(true)
  );
  it.each([-1, 7, 8])('day_of_week=%i bị từ chối', d =>
    expect(safeParse(LichSchema, { ...baseLich, day_of_week: d }).ok).toBe(false)
  );

  it.each([0, 23])('hour=%i hợp lệ', h =>
    expect(safeParse(LichSchema, { ...baseLich, hour: h }).ok).toBe(true)
  );
  it.each([-1, 24])('hour=%i bị từ chối', h =>
    expect(safeParse(LichSchema, { ...baseLich, hour: h }).ok).toBe(false)
  );

  it.each([0, 59])('minute=%i hợp lệ', m =>
    expect(safeParse(LichSchema, { ...baseLich, minute: m }).ok).toBe(true)
  );
  it.each([-1, 60])('minute=%i bị từ chối', m =>
    expect(safeParse(LichSchema, { ...baseLich, minute: m }).ok).toBe(false)
  );

  it('session_name rỗng bị từ chối', () =>
    expect(safeParse(LichSchema, { ...baseLich, session_name: '' }).ok).toBe(false)
  );
  it('session_name 100 ký tự hợp lệ', () =>
    expect(safeParse(LichSchema, { ...baseLich, session_name: 'x'.repeat(100) }).ok).toBe(true)
  );
  it('session_name 101 ký tự bị từ chối', () =>
    expect(safeParse(LichSchema, { ...baseLich, session_name: 'x'.repeat(101) }).ok).toBe(false)
  );

  it.each([null, undefined])('close_day_of_week=%s chấp nhận', v =>
    expect(safeParse(LichSchema, { ...baseLich, close_day_of_week: v }).ok).toBe(true)
  );
});

// ─── SessionSchema ─────────────────────────────────────────────────────────────
describe('SessionSchema', () => {
  const base = {
    id: '00000000-0000-0000-0000-000000000002',
    guild_id: '123', session_name: 'S', started_by: 'scheduler', is_active: true,
  };

  it('hợp lệ tối thiểu', () => expect(safeParse(SessionSchema, base).ok).toBe(true));
  it('eligible_member_ids=null chấp nhận', () =>
    expect(safeParse(SessionSchema, { ...base, eligible_member_ids: null }).ok).toBe(true)
  );
  it('eligible_member_ids=[] chấp nhận', () =>
    expect(safeParse(SessionSchema, { ...base, eligible_member_ids: [] }).ok).toBe(true)
  );
  it('eligible_member_ids=["u1","u2"] chấp nhận', () =>
    expect(safeParse(SessionSchema, { ...base, eligible_member_ids: ['u1','u2'] }).ok).toBe(true)
  );
  it('thiếu is_active bị từ chối', () => {
    const { is_active: _, ...noActive } = base;
    expect(safeParse(SessionSchema, noActive).ok).toBe(false);
  });
  it('id không phải UUID bị từ chối', () =>
    expect(safeParse(SessionSchema, { ...base, id: 'not-uuid' }).ok).toBe(false)
  );
  it('auto_close_at ISO string chấp nhận', () =>
    expect(safeParse(SessionSchema, { ...base, auto_close_at: '2026-06-01T12:00:00.000Z' }).ok).toBe(true)
  );
  it('auto_close_at không phải ISO bị từ chối', () =>
    expect(safeParse(SessionSchema, { ...base, auto_close_at: 'hom-nay' }).ok).toBe(false)
  );
});

// ─── AttendanceSchema ────────────────────────────────────────────────────────────
describe('AttendanceSchema', () => {
  const base = { session_id: '00000000-0000-0000-0000-000000000002', user_id: 'u1' };
  const validStatuses = ['tham_gia', 'tre', 'khong_tham_gia', 'co_phep'];

  it.each(validStatuses)('status=%s hợp lệ', s =>
    expect(safeParse(AttendanceSchema, { ...base, status: s }).ok).toBe(true)
  );
  it.each(['di_tre', 'absent', 'present', ''])('status=%s bị từ chối', s =>
    expect(safeParse(AttendanceSchema, { ...base, status: s }).ok).toBe(false)
  );
  it('không có status vẫn hợp lệ (optional)', () =>
    expect(safeParse(AttendanceSchema, base).ok).toBe(true)
  );
  it('session_id không phải UUID bị từ chối', () =>
    expect(safeParse(AttendanceSchema, { ...base, session_id: 'abc' }).ok).toBe(false)
  );
});

// ─── ConfigSchema ─────────────────────────────────────────────────────────────────
describe('ConfigSchema', () => {
  it('hợp lệ tối thiểu', () =>
    expect(safeParse(ConfigSchema, { guild_id: 'g1' }).ok).toBe(true)
  );
  it('guild_id rỗng bị từ chối', () =>
    expect(safeParse(ConfigSchema, { guild_id: '' }).ok).toBe(false)
  );
  it('thiếu guild_id bị từ chối', () =>
    expect(safeParse(ConfigSchema, {}).ok).toBe(false)
  );
});

// ─── BatDauInputSchema ───────────────────────────────────────────────────────────
describe('BatDauInputSchema', () => {
  it('tối thiểu hợp lệ', () =>
    expect(safeParse(BatDauInputSchema, { session_name: 'Họp' }).ok).toBe(true)
  );
  it('session_name rỗng bị từ chối', () =>
    expect(safeParse(BatDauInputSchema, { session_name: '' }).ok).toBe(false)
  );
  it('session_name > 100 ký tự bị từ chối', () =>
    expect(safeParse(BatDauInputSchema, { session_name: 'x'.repeat(101) }).ok).toBe(false)
  );
  it('allowed_role_id null chấp nhận', () =>
    expect(safeParse(BatDauInputSchema, { session_name: 'Họp', allowed_role_id: null }).ok).toBe(true)
  );
});
