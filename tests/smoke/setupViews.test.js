// tests/smoke/setupViews.test.js
// Test: ConfigView + ScheduleView + MemberView + handlers
// (Commit 4: 3 views + 3 handlers)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

function mockModule(modulePath, exports) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved, filename: resolved, loaded: true,
    exports, children: [], paths: [],
  };
}

const mockGetGuildConfig        = vi.fn().mockResolvedValue({});
const mockGetScheduledSessions  = vi.fn().mockResolvedValue([]);
const mockGetMembers            = vi.fn().mockResolvedValue([]);
const mockDeleteScheduledSession = vi.fn().mockResolvedValue(null);
const mockDeleteMember          = vi.fn().mockResolvedValue(null);

mockModule('../../db.js', {
  getGuildConfig:        (...a) => mockGetGuildConfig(...a),
  getScheduledSessions:  (...a) => mockGetScheduledSessions(...a),
  getMembers:            (...a) => mockGetMembers(...a),
  deleteScheduledSession: (...a) => mockDeleteScheduledSession(...a),
  deleteMember:          (...a) => mockDeleteMember(...a),
});
mockModule('../../utils/logger.js', {
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
});
mockModule('../../utils/embeds.js', {
  FOOTER_DEFAULT: 'TEST_FOOTER',
});
mockModule('@sapphire/framework', {
  InteractionHandler: class {
    constructor(ctx, opts) { Object.assign(this, opts); }
    some() { return { some: true }; }
    none() { return { none: true }; }
  },
  InteractionHandlerTypes: { Button: 'Button' },
});

const { ConfigView }  = require('../../src/commands/setup/ConfigView.js');
const { ScheduleView } = require('../../src/commands/setup/ScheduleView.js');
const { MemberView }   = require('../../src/commands/setup/MemberView.js');
const { SetupConfigHandler }  = require('../../interaction-handlers/setup/setupConfig.js');
const { SetupScheduleHandler } = require('../../interaction-handlers/setup/setupSchedule.js');
const { SetupMemberHandler }   = require('../../interaction-handlers/setup/setupMember.js');

const guild = { id: 'g1', name: 'Test Guild' };

beforeEach(() => vi.clearAllMocks());

describe('ConfigView.render()', () => {
  it('render với cfg rỗng → 1 embed + 2 rows', () => {
    const v = ConfigView.render({ cfg: {}, guild });
    expect(v.embeds).toHaveLength(1);
    expect(v.components).toHaveLength(2);
  });

  it('render với đầy đủ config → hiển thị channel + phai + tz + reminder', () => {
    const v = ConfigView.render({
      cfg: { log_channel_id: '123', phai_role_ids: ['r1'], timezone: 'Asia/Ho_Chi_Minh', reminder_enabled: true, reminder_minutes: 10 },
      guild,
    });
    const desc = v.embeds[0].toJSON().description;
    expect(desc).toMatch(/<#123>/);
    expect(desc).toMatch(/<@&r1>/);
    expect(desc).toMatch(/Asia\/Ho_Chi_Minh/);
    expect(desc).toMatch(/10 phút trước/);
  });

  it('reminder_enabled=false → hiển thị ⛔ Tắt', () => {
    const v = ConfigView.render({ cfg: { reminder_enabled: false }, guild });
    const desc = v.embeds[0].toJSON().description;
    expect(desc).toMatch(/Tắt/);
  });

  it('edit row có 4 nút', () => {
    const v = ConfigView.render({ cfg: {}, guild });
    const editRow = v.components[0].toJSON();
    expect(editRow.components).toHaveLength(4);
  });
});

describe('ScheduleView.render()', () => {
  it('render rỗng → 1 embed + 2 rows (add + nav, không có del row)', () => {
    const v = ScheduleView.render({ schedules: [], page: 0, guild });
    expect(v.embeds).toHaveLength(1);
    expect(v.components).toHaveLength(2);
  });

  it('render với 3 lịch → 1 embed + 3 rows (del + add + nav)', () => {
    const schedules = [1,2,3].map(i => ({ id: `s${i}`, day_of_week: i, hour: 20, minute: 0, session_name: `S${i}` }));
    const v = ScheduleView.render({ schedules, page: 0, guild });
    const delRow = v.components[0].toJSON();
    expect(delRow.components).toHaveLength(3);
  });

  it('render với 6 lịch + page=1 → chỉ hiển thị lịch 6', () => {
    const schedules = [1,2,3,4,5,6].map(i => ({ id: `s${i}`, day_of_week: i % 7, hour: 20, minute: 0, session_name: `S${i}` }));
    const v = ScheduleView.render({ schedules, page: 1, guild });
    const desc = v.embeds[0].toJSON().description;
    expect(desc).toMatch(/6\./);  // chỉ lịch 6 ở trang 2
    expect(desc).not.toMatch(/1\./);
  });

  it('pagination: page 0 → nút Trước disabled, nút Sau enabled', () => {
    const schedules = [1,2,3,4,5,6].map(i => ({ id: `s${i}`, day_of_week: i % 7, hour: 20, minute: 0, session_name: `S${i}` }));
    const v = ScheduleView.render({ schedules, page: 0, guild });
    const navRow = v.components[2].toJSON();
    const prevBtn = navRow.components.find(b => b.label.includes('Trước'));
    const nextBtn = navRow.components.find(b => b.label.includes('Sau'));
    expect(prevBtn.disabled).toBe(true);
    expect(nextBtn.disabled).toBe(false);
  });

  it('pagination: page cuối → nút Sau disabled', () => {
    const schedules = [1,2,3,4,5,6].map(i => ({ id: `s${i}`, day_of_week: i % 7, hour: 20, minute: 0, session_name: `S${i}` }));
    const v = ScheduleView.render({ schedules, page: 1, guild });
    const navRow = v.components[2].toJSON();
    const nextBtn = navRow.components.find(b => b.label.includes('Sau'));
    expect(nextBtn.disabled).toBe(true);
  });

  it('pre_close_minutes > 0 → hiển thị "đóng DD trước 30p"', () => {
    const v = ScheduleView.render({
      schedules: [{ id: 's1', day_of_week: 6, hour: 20, minute: 0, session_name: 'A', pre_close_minutes: 30 }],
      page: 0, guild,
    });
    const desc = v.embeds[0].toJSON().description;
    expect(desc).toMatch(/đóng DD trước 30p/);
  });
});

describe('MemberView.render()', () => {
  it('render rỗng → 1 embed + 2 rows', () => {
    const v = MemberView.render({ members: [], page: 0, guild });
    expect(v.embeds).toHaveLength(1);
    expect(v.components).toHaveLength(2);
  });

  it('render với 3 thành viên → 1 embed + 3 rows (del + add + nav)', () => {
    const members = [
      { user_id: 'u1', username: 'Alice', phong_ban: 'A' },
      { user_id: 'u2', username: 'Bob',   phong_ban: 'B' },
      { user_id: 'u3', username: 'Carol', ghi_chu: 'VIP' },
    ];
    const v = MemberView.render({ members, page: 0, guild });
    const desc = v.embeds[0].toJSON().description;
    expect(desc).toMatch(/<@u1>.*\(A\)/);
    expect(desc).toMatch(/<@u2>.*\(B\)/);
    expect(desc).toMatch(/<@u3>.*VIP/);
  });

  it('render 12 thành viên → 2 trang', () => {
    const members = [1,2,3,4,5,6,7,8,9,10,11,12].map(i => ({ user_id: `u${i}`, username: `U${i}` }));
    const v = MemberView.render({ members, page: 0, guild });
    expect(v._totalPages).toBe(2);
  });
});

describe('SetupConfigHandler', () => {
  it('parse: setup:cfg và setup:home → match', () => {
    const h = new SetupConfigHandler({}, {});
    expect(h.parse({ customId: 'setup:cfg' })).toBeTruthy();
    expect(h.parse({ customId: 'setup:home' })).toBeTruthy();
  });

  it('parse: customId khác → none', () => {
    const h = new SetupConfigHandler({}, {});
    expect(h.parse({ customId: 'setup:sch' })).toEqual({ none: true });
  });

  it('run: editReply với Config view', async () => {
    mockGetGuildConfig.mockResolvedValue({ log_channel_id: '123' });
    const h = new SetupConfigHandler({}, {});
    const i = {
      customId: 'setup:cfg',
      guild,
      deferUpdate: vi.fn().mockResolvedValue(null),
      editReply: vi.fn().mockResolvedValue(null),
    };
    await h.run(i);
    expect(i.editReply).toHaveBeenCalledOnce();
    const arg = i.editReply.mock.calls[0][0];
    expect(arg.embeds).toHaveLength(1);
  });
});

describe('SetupScheduleHandler', () => {
  it('parse: setup:sch, page:next/prev, del:* → match', () => {
    const h = new SetupScheduleHandler({}, {});
    expect(h.parse({ customId: 'setup:sch' })).toBeTruthy();
    expect(h.parse({ customId: 'setup:sch:page:next' })).toBeTruthy();
    expect(h.parse({ customId: 'setup:sch:del:abc' })).toBeTruthy();
  });

  it('parse: customId khác → none', () => {
    const h = new SetupScheduleHandler({}, {});
    expect(h.parse({ customId: 'setup:cfg' })).toEqual({ none: true });
  });

  it('run: del: → gọi deleteScheduledSession + render lại', async () => {
    mockGetScheduledSessions.mockResolvedValue([]);
    const h = new SetupScheduleHandler({}, {});
    const i = {
      customId: 'setup:sch:del:s1',
      guild,
      deferUpdate: vi.fn().mockResolvedValue(null),
      editReply: vi.fn().mockResolvedValue(null),
    };
    await h.run(i);
    expect(mockDeleteScheduledSession).toHaveBeenCalledWith('s1');
    expect(i.editReply).toHaveBeenCalled();
  });

  it('run: page:next → render với page + 1', async () => {
    mockGetScheduledSessions.mockResolvedValue(
      [1,2,3,4,5,6].map(i => ({ id: `s${i}`, day_of_week: i, hour: 20, minute: 0, session_name: `S${i}` }))
    );
    const h = new SetupScheduleHandler({}, {});
    const i = {
      customId: 'setup:sch:page:next',
      guild,
      deferUpdate: vi.fn().mockResolvedValue(null),
      editReply: vi.fn().mockResolvedValue(null),
      message: { embeds: [{ footer: { text: 'Trang 1/2 · Tổng 6 lịch' } }] },
    };
    await h.run(i);
    expect(i.editReply).toHaveBeenCalled();
  });
});

describe('SetupMemberHandler', () => {
  it('parse: setup:mem, page:*, del:* → match', () => {
    const h = new SetupMemberHandler({}, {});
    expect(h.parse({ customId: 'setup:mem' })).toBeTruthy();
    expect(h.parse({ customId: 'setup:mem:page:next' })).toBeTruthy();
    expect(h.parse({ customId: 'setup:mem:del:u1' })).toBeTruthy();
  });

  it('parse: customId khác → none', () => {
    const h = new SetupMemberHandler({}, {});
    expect(h.parse({ customId: 'setup:cfg' })).toEqual({ none: true });
  });

  it('run: del: → gọi deleteMember + render lại', async () => {
    mockGetMembers.mockResolvedValue([]);
    const h = new SetupMemberHandler({}, {});
    const i = {
      customId: 'setup:mem:del:u1',
      guild,
      deferUpdate: vi.fn().mockResolvedValue(null),
      editReply: vi.fn().mockResolvedValue(null),
    };
    await h.run(i);
    expect(mockDeleteMember).toHaveBeenCalledWith('g1', 'u1');
    expect(i.editReply).toHaveBeenCalled();
  });
});
