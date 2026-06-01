import { describe, it, expect } from 'vitest';
import { LichSchema, SessionSchema, AttendanceSchema, BatDauInputSchema, safeParse } from '../utils/validate.js';

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
    expect(safeParse(LichSchema, validLich).ok).toBe(true);
  });
  it('từ chối day_of_week > 6', () => {
    const r = safeParse(LichSchema, { ...validLich, day_of_week: 7 });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('day_of_week');
  });
  it('từ chối hour > 23', () => {
    expect(safeParse(LichSchema, { ...validLich, hour: 24 }).ok).toBe(false);
  });
  it('từ chối session_name rỗng', () => {
    expect(safeParse(LichSchema, { ...validLich, session_name: '' }).ok).toBe(false);
  });
  it('chấp nhận close_day_of_week null', () => {
    expect(safeParse(LichSchema, { ...validLich, close_day_of_week: null }).ok).toBe(true);
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
    expect(safeParse(SessionSchema, validSession).ok).toBe(true);
  });
  it('eligible_member_ids nullable', () => {
    expect(safeParse(SessionSchema, { ...validSession, eligible_member_ids: null }).ok).toBe(true);
  });
  it('từ chối thiếu is_active', () => {
    const { is_active: _, ...noActive } = validSession;
    expect(safeParse(SessionSchema, noActive).ok).toBe(false);
  });
});

describe('AttendanceSchema', () => {
  const base = { session_id: '00000000-0000-0000-0000-000000000002', user_id: 'u1' };

  it('reject status không hợp lệ', () => {
    const r = safeParse(AttendanceSchema, { ...base, status: 'di_tre' });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('status');
  });
  it('accept tất cả status hợp lệ', () => {
    for (const s of ['tham_gia', 'tre', 'khong_tham_gia', 'co_phep']) {
      expect(safeParse(AttendanceSchema, { ...base, status: s }).ok).toBe(true);
    }
  });
});

describe('BatDauInputSchema', () => {
  it('parse input hợp lệ', () => {
    expect(safeParse(BatDauInputSchema, { session_name: 'Họp' }).ok).toBe(true);
  });
  it('từ chối session_name > 100 ký tự', () => {
    expect(safeParse(BatDauInputSchema, { session_name: 'x'.repeat(101) }).ok).toBe(false);
  });
});
