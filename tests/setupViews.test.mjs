import { describe, it, expect } from 'vitest';
import { HomeView } from '../src/commands/setup/_views/_HomeView.js';

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