import { describe, it, expect } from 'vitest';
import { buildConfirmRow, buildAttendanceSelectRow, buildSessionActionRow, buildHistoryNavRow } from '../utils/_views/rows.js';
import { buildRankEmbed } from '../utils/_views/rankView.js';
import { buildSessionEmbed, buildClosedSessionEmbed } from '../utils/_views/sessionView.js';

describe('buildConfirmRow', () => {
  it('returns ActionRow with 2 buttons', () => {
    const row = buildConfirmRow();
    const json = row.toJSON();
    expect(json.type).toBe(1);
    expect(json.components).toHaveLength(2);
    expect(json.components[0].custom_id).toBe('confirm');
    expect(json.components[1].custom_id).toBe('cancel');
  });
});

describe('buildAttendanceSelectRow', () => {
  it('has 4 status options', () => {
    const row = buildAttendanceSelectRow(true);
    const select = row.toJSON().components[0];
    expect(select.custom_id).toBe('attendance:select');
    expect(select.options).toHaveLength(4);
    expect(select.options.map(o => o.value)).toEqual(['tham_gia', 'tre', 'co_phep', 'khong_tham_gia']);
  });

  it('is disabled when isOpen=false', () => {
    expect(buildAttendanceSelectRow(false).toJSON().components[0].disabled).toBe(true);
  });

  it('is enabled when isOpen=true', () => {
    expect(buildAttendanceSelectRow(true).toJSON().components[0].disabled).toBeFalsy();
  });
});

describe('buildSessionActionRow', () => {
  it('returns 2 ActionRows (≤5 total)', () => {
    const rows = buildSessionActionRow(true);
    expect(rows).toHaveLength(2);
    expect(rows.length).toBeLessThanOrEqual(5);
  });

  it('has 4 buttons in first row and 2 in second', () => {
    const rows = buildSessionActionRow(true);
    expect(rows[0].toJSON().components).toHaveLength(4);
    expect(rows[1].toJSON().components).toHaveLength(2);
  });

  it('buttons are enabled when isOpen=true', () => {
    for (const row of buildSessionActionRow(true)) {
      for (const btn of row.toJSON().components) {
        expect(btn.disabled).toBeFalsy();
      }
    }
  });

  it('buttons are disabled when isOpen=false', () => {
    for (const row of buildSessionActionRow(false)) {
      for (const btn of row.toJSON().components) {
        expect(btn.disabled).toBe(true);
      }
    }
  });

  it('contains expected button customIds', () => {
    const ids = buildSessionActionRow(true).flatMap(r => r.toJSON().components.map(c => c.custom_id));
    expect(ids).toContain('attend_view');
    expect(ids).toContain('attend_refresh');
    expect(ids).toContain('admin:mark');
    expect(ids).toContain('admin:edit');
    expect(ids).toContain('session:cancel');
    expect(ids).toContain('attend_close');
  });
});

describe('buildHistoryNavRow', () => {
  it('prev disabled on first page', () => {
    const json = buildHistoryNavRow(0, 5).toJSON();
    expect(json.components[0].disabled).toBe(true);
    expect(json.components[1].disabled).toBe(false);
  });

  it('next disabled on last page', () => {
    const json = buildHistoryNavRow(5, 5).toJSON();
    expect(json.components[0].disabled).toBe(false);
    expect(json.components[1].disabled).toBe(true);
  });

  it('both enabled in middle pages', () => {
    const json = buildHistoryNavRow(2, 5).toJSON();
    expect(json.components[0].disabled).toBe(false);
    expect(json.components[1].disabled).toBe(false);
  });
});

describe('buildRankEmbed', () => {
  it('returns empty state when no rows', () => {
    const json = buildRankEmbed([], null).toJSON();
    expect(json.description).toMatch(/Chưa có dữ liệu/);
  });

  it('shows medals for top 3 members', () => {
    const rows = [
      { user_id: 'u1', total_joined: 10, total_sessions: 10, current_streak: 5 },
      { user_id: 'u2', total_joined: 8, total_sessions: 10, current_streak: 3 },
      { user_id: 'u3', total_joined: 5, total_sessions: 10, current_streak: 1 },
    ];
    const json = buildRankEmbed(rows, null, 3).toJSON();
    expect(json.title).toMatch(/Top 3/);
    expect(json.description).toContain('🥇');
    expect(json.description).toContain('🥈');
    expect(json.description).toContain('🥉');
  });

  it('limits display to topN despite more rows', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ user_id: `u${i}`, total_joined: 10 - i, total_sessions: 10, current_streak: 0 }));
    const json = buildRankEmbed(rows, null, 3).toJSON();
    expect(json.title).toMatch(/Top 3/);
  });
});

describe('buildSessionEmbed (active session)', () => {
  const now = Date.now();
  const session = {
    id: 's1', guild_id: 'g1', session_name: 'Bang Chiến 1',
    is_active: true,
    started_at: new Date(now - 3600000).toISOString(),
    eligible_member_ids: [],
    channel_id: 'ch1', started_by: 'admin1',
    description: 'Test kỳ',
  };
  const attended = [
    { user_id: 'u1', status: 'tham_gia', checked_in_at: new Date(now - 1800000).toISOString() },
    { user_id: 'u2', status: 'tre', checked_in_at: new Date(now - 600000).toISOString() },
    { user_id: 'u3', status: 'khong_tham_gia', checked_in_at: new Date(now).toISOString() },
    { user_id: 'u4', status: 'co_phep', checked_in_at: new Date(now).toISOString() },
  ];

  it('returns embed with session title and stats', () => {
    const { embed, components, totalPages } = buildSessionEmbed(null, session, attended);
    const json = embed.toJSON();
    expect(json.title).toMatch(/Điểm danh Bang Chiến/);
    expect(json.description).toContain('50%');
    expect(totalPages).toBe(1);
    expect(components).toHaveLength(0);
  });

  it('has list field containing status groups', () => {
    const json = buildSessionEmbed(null, session, attended).embed.toJSON();
    const listField = json.fields.find(f => f.name.includes('Danh sách'));
    expect(listField).toBeDefined();
    expect(listField.value).toContain('Đúng giờ');
    expect(listField.value).toContain('Trễ');
    expect(listField.value).toContain('Có phép');
    expect(listField.value).toContain('Vắng');
  });

  it('adds pagination components when >15 attendees', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      user_id: `u${i}`, status: i < 10 ? 'tham_gia' : 'tre',
      checked_in_at: new Date(now).toISOString(),
    }));
    const { components, totalPages } = buildSessionEmbed(null, session, many);
    expect(totalPages).toBe(2);
    expect(components.length).toBeGreaterThanOrEqual(1);
  });
});

describe('buildClosedSessionEmbed', () => {
  const now = Date.now();
  const session = {
    id: 's1', guild_id: 'g1', session_name: 'Bang Chiến 1',
    is_active: false,
    started_at: new Date(now - 7200000).toISOString(),
    ended_at: new Date(now).toISOString(),
    eligible_member_ids: [],
    started_by: 'admin1',
  };
  const attended = Array.from({ length: 8 }, (_, i) => ({
    user_id: `u${i}`, status: i < 3 ? 'tham_gia' : i < 5 ? 'tre' : 'khong_tham_gia',
    checked_in_at: new Date(now - 600000).toISOString(),
  }));

  it('shows closed title and summary', () => {
    const embed = buildClosedSessionEmbed(session, attended, null);
    const json = embed.toJSON();
    expect(json.title).toMatch(/Đã kết thúc/);
    expect(json.description).toContain('Tổng số');
  });

  it('shows top 5 with "và N người khác" for >5 attendees', () => {
    const embed = buildClosedSessionEmbed(session, attended, null);
    const json = embed.toJSON();
    const listField = json.fields.find(f => f.name.includes('Thành viên'));
    expect(listField).toBeDefined();
    expect(listField.value).toMatch(/và .+ người khác/);
  });
});
