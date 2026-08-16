import { describe, it, expect } from 'vitest';
import { buildConfirmRow, buildAttendanceSelectRow, buildAttendanceConfirmRow, buildBoardRow, buildAttendanceFilterRow, buildHistoryNavRow } from '../utils/_views/rows.js';
import { buildRankEmbed } from '../utils/_views/rankView.js';
import { buildSessionEmbed, buildClosedSessionEmbed, sessionEmbedColor } from '../utils/_views/sessionView.js';
import { buildAttendanceConfirmPrompt } from '../utils/_views/attendView.js';

describe('buildConfirmRow', () => {
  it('returns an ActionRowBuilder with 2 buttons', () => {
    const row = buildConfirmRow('confirm_id', 'cancel_id');
    const json = row.toJSON();
    expect(json.type).toBe(1);
    expect(json.components).toHaveLength(2);
    expect(json.components[0].custom_id).toBe('confirm_id');
    expect(json.components[1].custom_id).toBe('cancel_id');
  });

  it('sets custom labels when provided', () => {
    const row = buildConfirmRow('c', 'x', 'Đồng ý', 'Bỏ qua');
    const json = row.toJSON();
    expect(json.components[0].label).toBe('Đồng ý');
    expect(json.components[1].label).toBe('Bỏ qua');
  });

  it('uses Danger style for confirm and Secondary for cancel', () => {
    const row = buildConfirmRow('c', 'x');
    const json = row.toJSON();
    expect(json.components[0].style).toBe(4);
    expect(json.components[1].style).toBe(2);
  });
});

describe('buildAttendanceSelectRow', () => {
  it('returns an ActionRow with a StringSelectMenu', () => {
    const row = buildAttendanceSelectRow(true);
    const json = row.toJSON();
    expect(json.type).toBe(1);
    expect(json.components).toHaveLength(1);
    expect(json.components[0].type).toBe(3);
    expect(json.components[0].custom_id).toBe('attendance:select');
    expect(json.components[0].options).toHaveLength(4);
  });

  it('is enabled when isOpen=true and disabled when isOpen=false', () => {
    expect(buildAttendanceSelectRow(true).toJSON().components[0].disabled).toBeFalsy();
    expect(buildAttendanceSelectRow(false).toJSON().components[0].disabled).toBe(true);
  });
});

describe('buildBoardRow', () => {
  it('returns 1 ActionRow with 2 buttons (attend_view + attend_list)', () => {
    const row = buildBoardRow(true);
    const json = row.toJSON();
    expect(json.type).toBe(1);
    expect(json.components).toHaveLength(2);
    expect(json.components.map(c => c.custom_id)).toEqual(['attend_view', 'attend_list']);
  });

  it('buttons enabled when isOpen=true', () => {
    expect(buildBoardRow(true).toJSON().components.every(c => !c.disabled)).toBe(true);
  });

  it('when closed: attend_view disabled but attend_list stays enabled', () => {
    const json = buildBoardRow(false).toJSON();
    const byId = Object.fromEntries(json.components.map(c => [c.custom_id, c.disabled]));
    expect(byId.attend_view).toBe(true);
    expect(byId.attend_list).toBeUndefined();
  });
});

describe('buildAttendanceFilterRow', () => {
  it('returns 5 filter buttons (all/tham_gia/tre/khong_tham_gia/co_phep)', () => {
    const json = buildAttendanceFilterRow('all').toJSON();
    expect(json.type).toBe(1);
    expect(json.components).toHaveLength(5);
    expect(json.components.map(c => c.custom_id)).toEqual([
      'attend_list:filter:all',
      'attend_list:filter:tham_gia',
      'attend_list:filter:tre',
      'attend_list:filter:khong_tham_gia',
      'attend_list:filter:co_phep',
    ]);
  });

  it('active filter button has Primary style', () => {
    const json = buildAttendanceFilterRow('tre').toJSON();
    const active = json.components.find(c => c.custom_id === 'attend_list:filter:tre');
    expect(active.style).toBe(1);
    const inactive = json.components.find(c => c.custom_id === 'attend_list:filter:all');
    expect(inactive.style).toBe(2);
  });

  it('appends sessionId suffix to filter customIds when provided', () => {
    const json = buildAttendanceFilterRow('all', 'sess-123').toJSON();
    expect(json.components.map(c => c.custom_id)).toEqual([
      'attend_list:filter:all:sess-123',
      'attend_list:filter:tham_gia:sess-123',
      'attend_list:filter:tre:sess-123',
      'attend_list:filter:khong_tham_gia:sess-123',
      'attend_list:filter:co_phep:sess-123',
    ]);
  });
});

describe('buildAttendanceConfirmRow — [UX-P2] xác nhận riêng', () => {
  it('returns confirm + change buttons with sessionId embedded', () => {
    const json = buildAttendanceConfirmRow('sess-1', 'tham_gia').toJSON();
    expect(json.type).toBe(1);
    expect(json.components).toHaveLength(2);
    expect(json.components[0].custom_id).toBe('attendance:confirm:sess-1:tham_gia');
    expect(json.components[0].label).toBe('✅ Xác nhận');
    expect(json.components[0].style).toBe(3); // Success
    expect(json.components[1].custom_id).toBe('attendance:change');
    expect(json.components[1].label).toBe('↩️ Đổi trạng thái');
    expect(json.components[1].style).toBe(2); // Secondary
  });
});

describe('buildAttendanceConfirmPrompt — [UX-P2] prompt xác nhận', () => {
  it('shows chosen status label and session name', () => {
    const { embeds } = buildAttendanceConfirmPrompt('tre', 'Bang Chiến Thứ 7');
    expect(embeds).toHaveLength(1);
    const json = embeds[0].toJSON();
    expect(json.title).toBe('❓ Xác nhận điểm danh');
    expect(json.description).toContain('⏰ Trễ');
    expect(json.description).toContain('Bang Chiến Thứ 7');
  });

  it('falls back for unknown status', () => {
    const { embeds } = buildAttendanceConfirmPrompt('bogus', 'Kỳ');
    expect(embeds[0].toJSON().description).toContain('❓ bogus');
  });
});

describe('buildHistoryNavRow', () => {
  it('prev disabled on first page', () => {
    const json = buildHistoryNavRow(0, 5).toJSON();
    expect(json.components[0].disabled).toBe(true);
    expect(json.components[1].disabled).toBeFalsy();
  });

  it('next disabled on last page', () => {
    const json = buildHistoryNavRow(5, 5).toJSON();
    expect(json.components[0].disabled).toBeFalsy();
    expect(json.components[1].disabled).toBe(true);
  });

  it('both enabled on middle page', () => {
    const json = buildHistoryNavRow(2, 5).toJSON();
    expect(json.components[0].disabled).toBeFalsy();
    expect(json.components[1].disabled).toBeFalsy();
  });

  it('uses custom prefix', () => {
    const json = buildHistoryNavRow(0, 2, 'member_hist').toJSON();
    expect(json.components[0].custom_id).toBe('member_hist:prev');
    expect(json.components[1].custom_id).toBe('member_hist:next');
  });
});

describe('buildRankEmbed', () => {
  const members = [
    { user_id: 'u1', current_streak: 5, total_joined: 10 },
    { user_id: 'u2', current_streak: 3, total_joined: 8 },
    { user_id: 'u3', current_streak: 1, total_joined: 2 },
  ];

  it('renders top members by current_streak', () => {
    const embed = buildRankEmbed(members, null, 10);
    const json = embed.toJSON();
    expect(json.title).toMatch(/bảng xếp hạng/i);
    expect(json.description).toContain('u1');
    expect(json.description).toContain('5');
  });

  it('shows empty state when members list is empty', () => {
    const embed = buildRankEmbed([], null, 10);
    const json = embed.toJSON();
    expect(json.description).toContain('Chưa có dữ liệu');
  });
});

describe('buildSessionEmbed (active session)', () => {
  const now = Date.now();
  const session = {
    id: 's1',
    session_name: 'Bang Chiến',
    is_active: true,
    started_at: new Date(now - 60000).toISOString(),
    auto_close_at: new Date(now + 3600000).toISOString(),
    description: 'Thứ 7 máu chảy về tim',
  };

  it('renders title with session name', () => {
    const { embed } = buildSessionEmbed(null, session, [], [], false, 1, null, false);
    expect(embed.toJSON().title).toContain('Bang Chiến');
  });

  it('renders plain-text stats — [UX-P3] no ANSI code block', () => {
    const attended = [
      { user_id: 'u1', status: 'tham_gia', checked_in_at: new Date(now).toISOString() },
      { user_id: 'u2', status: 'tre', checked_in_at: new Date(now).toISOString() },
      { user_id: 'u3', status: 'co_phep', checked_in_at: new Date(now).toISOString() },
    ];
    const { embed } = buildSessionEmbed(null, session, attended, [], false, 1, null, false);
    const json = embed.toJSON();
    expect(json.title).toBe('⚔️ Bang Chiến');
    expect(json.description).not.toContain('```ansi');
    expect(json.description).toContain('✅ Đúng giờ 1 · ⏰ Trễ 1 · ❌ Vắng 0 · 📋 Có phép 1');
    expect(json.description).not.toContain('Tỉ lệ tham gia');
  });

  it('shows auto-close countdown as plain relative timestamp', () => {
    const { embed } = buildSessionEmbed(null, session, [], [], false, 1, null, false);
    const json = embed.toJSON();
    expect(json.description).toContain('⏱️ Tự đóng <t:');
    expect(json.description).toContain('Thứ 7 máu chảy về tim');
    expect(json.description).not.toContain('```ansi');
  });

  it('renders member list field with grouped attendees', () => {
    const attended = [
      { user_id: 'u1', status: 'tham_gia', checked_in_at: new Date(now).toISOString() },
      { user_id: 'u2', status: 'tre', checked_in_at: new Date(now).toISOString() },
    ];
    const { embed } = buildSessionEmbed(null, session, attended, [], false, 1, null, false);
    const listField = embed.toJSON().fields.find(f => f.name.includes('Danh sách'));
    expect(listField).toBeDefined();
    expect(listField.value).toContain('Đúng giờ:');
    expect(listField.value).toContain('Trễ:');
    expect(listField.value).toContain('u1');
    expect(listField.value).toContain('u2');
  });

  it('paginates member list when >15 attendees', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      user_id: `u${i}`,
      status: 'tham_gia',
      checked_in_at: new Date(now + i).toISOString(),
    }));
    const { totalPages, components } = buildSessionEmbed(null, session, many, [], false, 1, null, false);
    expect(totalPages).toBe(2);
    expect(components.length).toBeGreaterThanOrEqual(1);
  });

  it('omits the member list field and pagination when showList=false', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      user_id: `u${i}`, status: i < 10 ? 'tham_gia' : 'tre',
      checked_in_at: new Date(now).toISOString(),
    }));
    const { embed, components, totalPages } = buildSessionEmbed(null, session, many, [], false, 1, null, false, { showList: false });
    expect((embed.toJSON().fields ?? []).some(f => f.name.includes('Danh sách'))).toBe(false);
    expect(components).toHaveLength(0);
    expect(totalPages).toBe(1);
  });

  it('hides page suffix in list title when showPageSuffix=false', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      user_id: `u${i}`, status: i < 10 ? 'tham_gia' : 'tre',
      checked_in_at: new Date(now).toISOString(),
    }));
    const { embed } = buildSessionEmbed(null, session, many, [], false, 1, null, false, { showPageSuffix: false });
    const listField = embed.toJSON().fields.find(f => f.name.includes('Danh sách'));
    expect(listField.name).not.toContain('trang');
  });

  it('uses custom pagination prefix from opts', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      user_id: `u${i}`, status: i < 10 ? 'tham_gia' : 'tre',
      checked_in_at: new Date(now).toISOString(),
    }));
    const { components } = buildSessionEmbed(null, session, many, [], false, 1, null, false, { paginationPrefix: 'attend_list' });
    const ids = components.flatMap(r => r.toJSON().components.map(c => c.custom_id));
    expect(ids.some(id => id.startsWith('attend_list:prev:'))).toBe(true);
    expect(ids.some(id => id.startsWith('attend_view:prev:'))).toBe(false);
  });

  it('filters list by status when opts.filter set', () => {
    const mixed = Array.from({ length: 20 }, (_, i) => ({
      user_id: `u${i}`,
      status: i < 10 ? 'tham_gia' : i < 15 ? 'tre' : 'khong_tham_gia',
      checked_in_at: new Date(now).toISOString(),
    }));
    const { embed, components, totalPages } = buildSessionEmbed(null, session, mixed, [], false, 1, null, false, { filter: 'tre' });
    const listField = embed.toJSON().fields.find(f => f.name.includes('Danh sách'));
    expect(listField.name).toContain('5');
    expect(listField.name).toContain('Trễ');
    expect(listField.value).not.toContain('Đúng giờ:');
    expect(listField.value).toContain('Trễ:');
    expect(totalPages).toBe(1);
    expect(components).toHaveLength(0);
  });

  it('pagination customIds carry filter suffix', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      user_id: `u${i}`,
      status: i < 10 ? 'tham_gia' : 'tre',
      checked_in_at: new Date(now).toISOString(),
    }));
    const { components } = buildSessionEmbed(null, session, many, [], false, 1, null, false, { paginationPrefix: 'attend_list', filter: 'tre' });
    const ids = components.flatMap(r => r.toJSON().components.map(c => c.custom_id));
    expect(ids.some(id => id.startsWith('attend_list:prev:1:tre'))).toBe(true);
    expect(ids.some(id => id.startsWith('attend_list:next:1:tre'))).toBe(true);
  });

  it('renders closed session when opts.allowClosed=true', () => {
    const closedSession = { ...session, is_active: false };
    const { embed } = buildSessionEmbed(null, closedSession, [], [], false, 1, null, false, { allowClosed: true });
    expect(embed.toJSON().title).toBe('⚔️ Bang Chiến');
    expect(embed.toJSON().description).toContain('🔒 Đã kết thúc');
  });

  it('prepends userLine to description — [UX-P2] trạng thái bản thân', () => {
    const { embed } = buildSessionEmbed(null, session, [], [], false, 1, null, false, { userLine: '👤 Hiện tại: ✅ Đúng giờ · ⚔️' });
    const desc = embed.toJSON().description;
    expect(desc.startsWith('👤 Hiện tại: ✅ Đúng giờ · ⚔️')).toBe(true);
  });
});

describe('buildClosedSessionEmbed', () => {
  const now = Date.now();
  const session = {
    id: 's1',
    session_name: 'Bang Chiến',
    is_active: false,
    started_at: new Date(now - 7200000).toISOString(),
    ended_at: new Date(now).toISOString(),
  };
  const attended = [
    { user_id: 'u1', status: 'tham_gia', checked_in_at: new Date(now - 7000000).toISOString() },
    { user_id: 'u2', status: 'tham_gia', checked_in_at: new Date(now - 6000000).toISOString() },
    { user_id: 'u3', status: 'tre', checked_in_at: new Date(now - 5000000).toISOString() },
    { user_id: 'u4', status: 'co_phep', checked_in_at: new Date(now - 4000000).toISOString() },
    { user_id: 'u5', status: 'khong_tham_gia', checked_in_at: new Date(now - 3000000).toISOString() },
    { user_id: 'u6', status: 'tham_gia', checked_in_at: new Date(now - 2000000).toISOString() },
  ];

  it('renders closed title with session name', () => {
    const embed = buildClosedSessionEmbed(session, attended, null);
    expect(embed.toJSON().title).toContain('Bang Chiến');
    expect(embed.toJSON().title).toContain('Đã kết thúc');
  });

  it('cancelled session → title Đã hủy + red', () => {
    const cancelled = { ...session, cancelled: true };
    const embed = buildClosedSessionEmbed(cancelled, attended, null);
    const json = embed.toJSON();
    expect(json.title).toContain('Đã hủy');
    expect(json.title).not.toContain('Đã kết thúc');
    expect(json.color).toBe(0xff4444);
  });

  it('closed session → grey', () => {
    const embed = buildClosedSessionEmbed(session, attended, null);
    expect(embed.toJSON().color).toBe(0x36393e);
  });

  it('shows stats summary in description', () => {
    const embed = buildClosedSessionEmbed(session, attended, null);
    const json = embed.toJSON();
    expect(json.description).toContain('Tỉ lệ tham gia');
    expect(json.description).toContain('Đúng giờ');
    expect(json.description).toContain('Tổng');
  });

  it('keeps board tinh gọn — no member list field after close', () => {
    const embed = buildClosedSessionEmbed(session, attended, null);
    const listField = embed.toJSON().fields?.find(f => f.name.includes('Thành viên'));
    expect(listField).toBeUndefined();
  });
});

describe('sessionEmbedColor — [UX-P3] màu theo trạng thái', () => {
  const now = Date.now();
  const base = { is_active: true, auto_close_at: new Date(now + 3600000).toISOString() };

  it('open session → green', () => {
    expect(sessionEmbedColor(base)).toBe(0x57f287);
  });

  it('closing soon (≤10 min) → yellow', () => {
    const closing = { ...base, auto_close_at: new Date(now + 3 * 60000).toISOString() };
    expect(sessionEmbedColor(closing)).toBe(0xfee75c);
  });

  it('closed session → grey', () => {
    expect(sessionEmbedColor({ is_active: false })).toBe(0x36393e);
  });

  it('cancelled session → red (ưu tiên hơn closed)', () => {
    expect(sessionEmbedColor({ is_active: false, cancelled: true })).toBe(0xff4444);
  });
});
