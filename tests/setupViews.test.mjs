import { describe, it, expect } from 'vitest';
import { HomeView } from '../src/commands/setup/_views/_HomeView.js';
import { SessionView } from '../src/commands/setup/_views/_SessionView.js';

function makeCache(arr) {
  return {
    ...arr.reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {}),
    get(k) { return this[k] ?? null; },
  };
}

const guild = {
  id: 'g1',
  name: 'Bang Test',
  iconURL: () => null,
  roles: { cache: makeCache([
    ['p1', { id: 'p1', name: 'Cái Bang' }],
    ['p2', { id: 'p2', name: 'Thiếu Lâm' }],
  ]) },
  members: { cache: makeCache([]) },
};

const cfgFull = {
  notification_channel_id: 'c1',
  admin_role_id: 'r1',
  attendance_role_id: 'r2',
  timezone: 'Asia/Ho_Chi_Minh',
  phai_role_ids: ['p1', 'p2'],
};

const members = [
  { user_id: 'u1', phai_role_ids: ['p1'] },
  { user_id: 'u2', phai_role_ids: ['p1'] },
  { user_id: 'u3', phai_role_ids: ['p2'] },
  { user_id: 'u4', phai_role_ids: [] },
];

const session = {
  id: 's1',
  session_name: 'Bang Chiến Thứ 7',
  channel_id: 'c1',
  started_by: 'u1',
  started_at: '2026-08-16T12:00:00Z',
  auto_close_at: '2026-08-16T13:00:00Z',
  eligible_member_ids: ['u1', 'u2', 'u3', 'u4'],
};

const attendances = [
  { user_id: 'u1', status: 'tham_gia' },
  { user_id: 'u2', status: 'tre' },
  { user_id: 'u3', status: 'khong_tham_gia' },
];

function rowsOf(view) {
  return view.components.map(r => r.toJSON());
}

describe('HomeView._computeState', () => {
  it('active khi có Kỳ đang mở', () => {
    expect(HomeView._computeState(cfgFull, members, [], [session]).state).toBe('active');
  });

  it('incomplete khi thiếu cấu hình — kèm checklist', () => {
    const res = HomeView._computeState({ timezone: 'Asia/Ho_Chi_Minh' }, members, [], []);
    expect(res.state).toBe('incomplete');
    expect(res.missing).toContain('Chọn kênh thông báo');
    expect(res.missing).toContain('Cấu hình role quản trị');
    expect(res.missing).toContain('Thêm role đối tượng điểm danh');
    expect(res.missing).toContain('Cấu hình phái');
  });

  it('incomplete khi chưa có thành viên', () => {
    const res = HomeView._computeState(cfgFull, [], [], []);
    expect(res.state).toBe('incomplete');
    expect(res.missing).toEqual(['Thêm thành viên']);
  });

  it('empty khi chưa có lịch nhưng cấu hình đủ', () => {
    expect(HomeView._computeState(cfgFull, members, [], []).state).toBe('empty');
  });

  it('ready khi mọi thứ đủ', () => {
    expect(HomeView._computeState(cfgFull, members, [{ id: 'sch1' }], []).state).toBe('ready');
  });
});

describe('HomeView.render — trạng thái', () => {
  it('ready: trạng thái xanh, không checklist', () => {
    const view = HomeView.render({ guild, cfg: cfgFull, schedules: [{ id: 'sch1' }], members, sessions: [] });
    const desc = view.embeds[0].data.description;
    expect(view.embeds[0].data.title).toBe('⚔️ Trung Tâm Chỉ Huy — Quản Gia');
    expect(desc).toContain('🟢 **Hệ thống sẵn sàng**');
    expect(desc).not.toContain('⬜');
    expect(view.embeds[0].data.color).toBe(0x437a22);
  });

  it('incomplete: ⚠️ + checklist + màu warning', () => {
    const view = HomeView.render({ guild, cfg: { timezone: 'Asia/Ho_Chi_Minh' }, schedules: [], members: [], sessions: [] });
    const desc = view.embeds[0].data.description;
    expect(desc).toContain('⚠️ **Server chưa sẵn sàng**');
    expect(desc).toContain('⬜ Chọn kênh thông báo');
    expect(desc).toContain('⬜ Cấu hình role quản trị');
    expect(desc).toContain('⬜ Cấu hình phái');
    expect(view.embeds[0].data.color).toBe(0x964219);
  });

  it('empty: 💤 + màu xám', () => {
    const view = HomeView.render({ guild, cfg: cfgFull, schedules: [], members, sessions: [] });
    expect(view.embeds[0].data.description).toContain('💤 **Chưa có dữ liệu**');
    expect(view.embeds[0].data.color).toBe(0x7a7974);
  });

  it('active: tên Kỳ, auto-close, quân số X/Y · %, phân bố phái', () => {
    const view = HomeView.render({ guild, cfg: cfgFull, schedules: [], members, sessions: [session], attendances });
    const desc = view.embeds[0].data.description;
    expect(desc).toContain('**Bang Chiến Thứ 7**');
    expect(desc).toContain('<t:');
    expect(desc).toContain('Quân số: **2/4** · **50%**');
    expect(desc).toContain('🔴 Cái Bang: **2**');
    expect(desc).toContain('🟠 Thiếu Lâm: **0**');
  });

  it('active: ghi chú +N Kỳ khác khi nhiều Kỳ', () => {
    const view = HomeView.render({ guild, cfg: cfgFull, schedules: [], members, sessions: [session, { ...session, id: 's2' }], attendances });
    expect(view.embeds[0].data.description).toContain('(+1 Kỳ khác)');
  });

  it('kế tiếp: lịch sắp mở + số lịch đang bật', () => {
    const schedules = [{ id: 'sch1', day_of_week: 6, hour: 21, minute: 0, session_name: 'Bang Chiến tuần' }];
    const view = HomeView.render({ guild, cfg: cfgFull, schedules, members, sessions: [], now: undefined });
    const desc = view.embeds[0].data.description;
    expect(desc).toContain('📅 **Kế tiếp**');
    expect(desc).toContain('Bang Chiến tuần');
    expect(desc).toContain('Lịch đang bật: 1');
  });
});

describe('HomeView.render — điều hướng', () => {
  it('hai hàng button đúng nhãn + customId', () => {
    const view = HomeView.render({ guild, cfg: cfgFull, schedules: [{ id: 'sch1' }], members, sessions: [] });
    const [main, action] = rowsOf(view);
    expect(main.components.map(c => c.custom_id)).toEqual([
      'setup:session', 'setup:stats', 'setup:audit', 'setup:cfg', 'setup:mem',
    ]);
    expect(main.components.map(c => c.label)).toEqual(['Bang Chiến', 'BXH', 'Nhật ký', 'Cài Đặt', 'Quân Số']);
    expect(action.components.map(c => c.custom_id)).toEqual([
      'setup:session:start', 'setup:sch', 'setup:session:broadcast', 'setup:home:refresh',
    ]);
    expect(action.components.map(c => c.label)).toEqual(['Mở Bang Chiến', 'Lịch', 'Phát Tin', 'Làm Mới']);
  });

  it('không còn nút History (setup:history)', () => {
    const view = HomeView.render({ guild, cfg: cfgFull, schedules: [{ id: 'sch1' }], members, sessions: [] });
    const ids = rowsOf(view).flatMap(r => r.components.map(c => c.custom_id));
    expect(ids).not.toContain('setup:history');
    expect(ids).not.toContain('📊');
  });

  it('nút Bang Chiến Primary khi có Kỳ mở', () => {
    const view = HomeView.render({ guild, cfg: cfgFull, schedules: [], members, sessions: [session], attendances });
    const [main] = rowsOf(view);
    expect(main.components[0].style).toBe(1);
  });

  it('nút Cài Đặt Primary khi chưa có kênh', () => {
    const view = HomeView.render({ guild, cfg: {}, schedules: [], members: [], sessions: [] });
    const [main] = rowsOf(view);
    expect(main.components[3].style).toBe(1);
  });
});

describe('HomeView.renderError', () => {
  it('embed đỏ + nút Thử lại + ← Dashboard', () => {
    const view = HomeView.renderError({ guild, reason: 'mất kết nối DB' });
    expect(view.embeds[0].data.title).toBe('❌ Không thể tải Dashboard');
    expect(view.embeds[0].data.description).toContain('mất kết nối DB');
    expect(view.embeds[0].data.color).toBe(0xa12c7b);
    const [row] = rowsOf(view);
    expect(row.components.map(c => c.custom_id)).toEqual(['setup:home:refresh', 'setup:home']);
    expect(row.components.map(c => c.label)).toEqual(['Thử lại', '← Dashboard']);
  });
});

describe('HomeView._nextSchedule (tz Asia/Ho_Chi_Minh)', () => {
  // CN 16/08/2026 12:00 giờ HCM
  const now = Date.parse('2026-08-16T05:00:00Z');
  const tz = 'Asia/Ho_Chi_Minh';

  it('null khi không có lịch', () => {
    expect(HomeView._nextSchedule([], tz, now)).toBeNull();
  });

  it('recurring cùng ngày chưa qua → hôm nay', () => {
    const res = HomeView._nextSchedule([{ id: 's', day_of_week: 0, hour: 18, minute: 0 }], tz, now);
    expect(res.at).toBe(Date.UTC(2026, 7, 16, 11, 0)); // 18:00 HCM = 11:00 UTC
  });

  it('recurring cùng ngày đã qua → tuần sau', () => {
    const res = HomeView._nextSchedule([{ id: 's', day_of_week: 0, hour: 10, minute: 0 }], tz, now);
    expect(res.at).toBe(Date.UTC(2026, 7, 23, 3, 0)); // CN sau 10:00 HCM
  });

  it('recurring T7 21:00 → Thứ 7 tuần sau', () => {
    const res = HomeView._nextSchedule([{ id: 's', day_of_week: 6, hour: 21, minute: 0 }], tz, now);
    expect(res.at).toBe(Date.UTC(2026, 7, 22, 14, 0));
  });

  it('one_time trong tương lai → đúng ngày giờ', () => {
    const res = HomeView._nextSchedule([{ id: 's', scheduled_date: '2026-08-25', hour: 21, minute: 0 }], tz, now);
    expect(res.at).toBe(Date.UTC(2026, 7, 25, 14, 0));
  });

  it('chọn lịch sắp nhất trong nhiều lịch', () => {
    const res = HomeView._nextSchedule([
      { id: 'a', scheduled_date: '2026-08-25', hour: 21, minute: 0 },
      { id: 'b', day_of_week: 6, hour: 21, minute: 0 },
    ], tz, now);
    expect(res.schedule.id).toBe('b');
  });

  it('bỏ qua lịch one_time đã qua', () => {
    const res = HomeView._nextSchedule([{ id: 's', scheduled_date: '2026-08-10', hour: 21, minute: 0 }], tz, now);
    expect(res).toBeNull();
  });
});

const session2 = {
  id: 's2',
  session_name: 'Bang Chiến Phụ',
  channel_id: 'c2',
  started_by: 'u2',
  started_at: '2026-08-16T15:00:00Z',
  eligible_member_ids: ['u1', 'u2', 'u3'],
};

function sessionViewRows(sessions, selected, atts = attendances, membersList = members) {
  const view = SessionView.renderSummary({
    session: selected, guild, cfg: cfgFull, members: membersList,
    attendances: atts, sessionCount: sessions.length, sessions,
  });
  return { view, rows: view.components.map(r => r.toJSON()) };
}

describe('SessionView — một Kỳ', () => {
  it('không có select chọn Kỳ và không có Đóng TẤT CẢ', () => {
    const { rows } = sessionViewRows([session], session);
    const ids = rows.flatMap(r => r.components.map(c => c.custom_id));
    expect(ids).not.toContain('setup:session:select');
    expect(ids).not.toContain('setup:session:close:all');
  });

  it('admin row nhúng đúng sessionId vào customId', () => {
    const { rows } = sessionViewRows([session], session);
    const admin = rows.find(r => r.components.some(c => c.custom_id?.startsWith('admin:mark:')));
    const ids = admin.components.map(c => c.custom_id);
    expect(ids).toContain('admin:mark:s1');
    expect(ids).toContain('admin:edit:s1');
    expect(ids).toContain('setup:session:cancel:s1');
    expect(ids).toContain('setup:session:close:s1');
  });

  it('footer encode sid:', () => {
    const { view } = sessionViewRows([session], session);
    expect(view.embeds[0].data.footer.text).toContain('sid:s1');
  });
});

describe('SessionView — nhiều Kỳ', () => {
  it('select xuất hiện với đủ option + default là Kỳ đang xem', () => {
    const { rows } = sessionViewRows([session, session2], session);
    const select = rows[0].components[0];
    expect(select.type).toBe(3);
    expect(select.custom_id).toBe('setup:session:select');
    expect(select.options).toHaveLength(2);
    expect(select.options.map(o => o.value)).toEqual(['s1', 's2']);
    expect(select.options.find(o => o.value === 's1').default).toBe(true);
    expect(select.options.find(o => o.value === 's2').default).toBe(false);
  });

  it('select default chuyển theo Kỳ đã chọn (s2)', () => {
    const { rows, view } = sessionViewRows([session, session2], session2);
    const select = rows[0].components[0];
    expect(select.options.find(o => o.value === 's2').default).toBe(true);
    expect(view.embeds[0].data.footer.text).toContain('sid:s2');
  });

  it('Đóng TẤT CẢ nằm hàng riêng, không kề Đóng Kỳ', () => {
    const { rows } = sessionViewRows([session, session2], session);
    const closeAllRow = rows.find(r => r.components.some(c => c.custom_id === 'setup:session:close:all'));
    expect(closeAllRow).toBeDefined();
    expect(closeAllRow.components[0].label).toBe('⚠️ Đóng TẤT CẢ (2)');
    expect(closeAllRow.components[0].style).toBe(4); // Danger
    const sameRow = rows.some(r => r.components.some(c => c.custom_id === 'setup:session:close:all')
      && r.components.some(c => c.custom_id === 'setup:session:close:s1' || c.custom_id === 'setup:session:cancel:s1'));
    expect(sameRow).toBe(false);
  });

  it('admin row theo Kỳ đã chọn (s2)', () => {
    const { rows } = sessionViewRows([session, session2], session2);
    const admin = rows.find(r => r.components.some(c => c.custom_id?.startsWith('admin:mark:')));
    const ids = admin.components.map(c => c.custom_id);
    expect(ids).toContain('setup:session:cancel:s2');
    expect(ids).toContain('setup:session:close:s2');
  });
});

describe('SessionView.parseFooter', () => {
  it('decode ctx + sid + page mặc định', () => {
    expect(SessionView.parseFooter({ text: '⚔️ · summary · sid:s1 · Quản Gia' }))
      .toEqual({ ctx: 'summary', sessionId: 's1', page: 0 });
  });

  it('decode roster + page', () => {
    expect(SessionView.parseFooter({ text: '⚔️ · roster · sid:s1 · p:2 · Quản Gia' }))
      .toEqual({ ctx: 'roster', sessionId: 's1', page: 2 });
  });

  it('footer trống → mặc định', () => {
    expect(SessionView.parseFooter(null)).toEqual({ ctx: 'summary', sessionId: null, page: 0 });
  });
});

describe('SessionView — roster/details encode state', () => {
  it('renderRoster footer chứa sid + p:', () => {
    const atts = [
      ...attendances,
      { user_id: 'u4', status: 'khong_tham_gia' },
      { user_id: 'u5', status: 'tham_gia' },
      { user_id: 'u6', status: 'tre' },
      { user_id: 'u7', status: 'tham_gia' },
      { user_id: 'u8', status: 'tham_gia' },
      { user_id: 'u9', status: 'tham_gia' },
      { user_id: 'u10', status: 'tham_gia' },
      { user_id: 'u11', status: 'tham_gia' },
      { user_id: 'u12', status: 'tham_gia' },
      { user_id: 'u13', status: 'tham_gia' },
      { user_id: 'u14', status: 'tham_gia' },
    ];
    const view = SessionView.renderRoster({ session, guild, attendances: atts, page: 1 });
    const ctx = SessionView.parseFooter(view.embeds[0].data.footer);
    expect(ctx.ctx).toBe('roster');
    expect(ctx.sessionId).toBe('s1');
    expect(ctx.page).toBe(1);
    const ids = view.components.map(r => r.toJSON()).flatMap(r => r.components.map(c => c.custom_id));
    expect(ids).toContain('setup:session:roster:prev');
    expect(ids).toContain('setup:session:roster:next');
  });

  it('renderDetails footer chứa sid:', () => {
    const view = SessionView.renderDetails({ session, guild, members, attendances, cfg: cfgFull });
    const ctx = SessionView.parseFooter(view.embeds[0].data.footer);
    expect(ctx.ctx).toBe('details');
    expect(ctx.sessionId).toBe('s1');
  });
});