import { describe, it, expect } from 'vitest';
import { LichSchema, SessionSchema, AttendanceSchema, safeParse } from '../utils/validate.js';

describe('LichSchema', () => {
  const validLich = {
    id: '00000000-0000-0000-0000-000000000001',
    guild_id: '123456789',
    channel_id: '987654321',
    session_name: 'Điểm danh tuần',
    day_of_week: 6,
    hour: 20,
    minute: 0,
    close_day_of_week: 6,
    close_hour: 22,
    close_minute: 0,
  };

  it('parse lịch hợp lệ', () => {
    const r = safeParse(LichSchema, validLich);
    expect(r.ok).toBe(true);
  });

  it('từ chối day_of_week > 6', () => {
    const r = safeParse(LichSchema, { ...validLich, day_of_week: 7 });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('day_of_week');
  });

  it('từ chối hour > 23', () => {
    const r = safeParse(LichSchema, { ...validLich, hour: 24 });
    expect(r.ok).toBe(false);
  });

  it('từ chối session_name rỗng', () => {
    const r = safeParse(LichSchema, { ...validLich, session_name: '' });
    expect(r.ok).toBe(false);
  });
});

describe('SessionSchema', () => {
  const validSession = {
    id: '00000000-0000-0000-0000-000000000002',
    guild_id: '123456789',
    session_name: 'Test session',
    started_by: 'scheduler',
    is_active: true,
  };

  it('parse session hợp lệ', () => {
    const r = safeParse(SessionSchema, validSession);
    expect(r.ok).toBe(true);
  });

  it('eligible_member_ids nullable', () => {
    const r = safeParse(SessionSchema, { ...validSession, eligible_member_ids: null });
    expect(r.ok).toBe(true);
  });
});

describe('AttendanceSchema', () => {
  it('reject status không hợp lệ', () => {
    const r = safeParse(AttendanceSchema, {
      session_id: '00000000-0000-0000-0000-000000000002',
      user_id: 'u1',
      status: 'di_tre', // sai
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('status');
  });

  it('accept tất cả status hợp lệ', () => {
    for (const s of ['tham_gia', 'tre', 'khong_tham_gia', 'co_phep']) {
      const r = safeParse(AttendanceSchema, {
        session_id: '00000000-0000-0000-0000-000000000002',
        user_id: 'u1',
        status: s,
      });
      expect(r.ok).toBe(true);
    }
  });
});
