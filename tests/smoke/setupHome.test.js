// tests/smoke/setupHome.test.js
// Test: HomeView.render() + SetupCommand + setupHome/SetupSession handlers
// (Commit 3: Smart Home dashboard)

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

// ─── Mocks: set tại module load (trước mọi require) ──────────────────────
const mockGetGuildConfig        = vi.fn().mockResolvedValue({
  log_channel_id: '123', timezone: 'Asia/Ho_Chi_Minh', phai_role_ids: ['r1', 'r2'],
});
const mockGetScheduledSessions   = vi.fn().mockResolvedValue([]);
const mockGetMembers             = vi.fn().mockResolvedValue([]);
const mockGetActiveSession       = vi.fn().mockResolvedValue(null);
const mockRequireAdmin           = vi.fn().mockReturnValue({ ok: true });

mockModule('../../db.js', {
  getGuildConfig:        (...a) => mockGetGuildConfig(...a),
  getScheduledSessions:  (...a) => mockGetScheduledSessions(...a),
  getMembers:            (...a) => mockGetMembers(...a),
  getActiveSession:      (...a) => mockGetActiveSession(...a),
  getConfig:             (...a) => mockGetGuildConfig(...a),
  getMemberStats:        vi.fn().mockResolvedValue({ current_streak: 0 }),
});
mockModule('../../utils/logger.js', {
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
});
mockModule('../../utils/permissions.js', {
  requireAdmin: (...a) => mockRequireAdmin(...a),
});
mockModule('../../utils/embeds.js', {
  FOOTER_DEFAULT: 'TEST_FOOTER',
  replyConfirm:  vi.fn().mockReturnValue({ embeds: [], components: [] }),
  replyErrEdit:  vi.fn().mockReturnValue({ embeds: [], components: [] }),
  replyErr:      vi.fn().mockReturnValue({ embeds: [], components: [] }),
  EmbedBuilder:  class { setColor() { return this; } setTitle() { return this; } setDescription() { return this; } addFields() { return this; } setThumbnail() { return this; } setFooter() { return this; } setTimestamp() { return this; } },
});
mockModule('@sapphire/framework', {
  InteractionHandler: class {
    constructor(ctx, opts) { Object.assign(this, opts); }
    some() { return { some: true }; }
    none() { return { none: true }; }
  },
  InteractionHandlerTypes: { Button: 'Button' },
  Command: class { constructor(ctx, opts) { Object.assign(this, opts); } },
});

// ─── Sources (require SAU khi mock đã set) ──────────────────────────────
const HomeViewModule  = require('../../src/commands/setup/_HomeView.js');
const HomeView        = HomeViewModule.HomeView;
const CUSTOM_ID       = HomeView.CUSTOM_ID;
const { SetupHomeHandler }   = require('../../interaction-handlers/setup/setupHome.js');
const { SetupSessionHandler } = require('../../interaction-handlers/setup/setupSession.js');

beforeEach(() => vi.clearAllMocks());

describe('HomeView.render()', () => {
  const guild = { id: 'g1', name: 'Test Guild', iconURL: () => 'https://example.com/avatar.png' };

  it('render không có session → 1 embed + 2 rows', () => {
    const view = HomeView.render({
      guild,
      cfg: { log_channel_id: '123', timezone: 'Asia/Ho_Chi_Minh', phai_role_ids: [] },
      schedules: [],
      members: [],
      session: null,
    });
    expect(view.embeds).toHaveLength(1);
    expect(view.components).toHaveLength(2);
  });

  it('render có session active → drilldown row có 4 nút, session row có 2 nút', () => {
    const view = HomeView.render({
      guild,
      cfg: { log_channel_id: '123', timezone: 'Asia/Ho_Chi_Minh', phai_role_ids: ['r1'] },
      schedules: [],
      members: [],
      session: { id: 's1', session_name: 'Test', channel_id: '456', started_by: 'u1', created_at: new Date().toISOString() },
    });
    const drillRow = view.components[0].toJSON();
    const sessRow  = view.components[1].toJSON();
    expect(drillRow.components).toHaveLength(4);
    expect(sessRow.components).toHaveLength(2);
    const closeBtn = sessRow.components.find(b => b.label.includes('Đóng'));
    expect(closeBtn.disabled).toBe(false);
    expect(closeBtn.style).toBe(4); // Danger
  });

  it('render không có session → nút Đóng phiên disabled', () => {
    const view = HomeView.render({ guild, cfg: {}, schedules: [], members: [], session: null });
    const sessRow = view.components[1].toJSON();
    const closeBtn = sessRow.components.find(b => b.label.includes('Đóng'));
    expect(closeBtn.disabled).toBe(true);
  });

  it('render có 2 schedules → hiển thị số lượng + top 2', () => {
    const view = HomeView.render({
      guild,
      cfg: {},
      schedules: [
        { id: 's1', day_of_week: 6, hour: 20, minute: 0, session_name: 'A', pre_close_minutes: 30 },
        { id: 's2', day_of_week: 0, hour: 9,  minute: 0, session_name: 'B' },
      ],
      members: [],
      session: null,
    });
    const desc = view.embeds[0].toJSON().description;
    expect(desc).toMatch(/2 lịch cố định/);
    expect(desc).toMatch(/T7 20:00.*A.*30p/);
    expect(desc).toMatch(/CN 09:00.*B/);
  });

  it('render có 5 schedules → hiển thị "...và 2 lịch khác"', () => {
    const schedules = [1,2,3,4,5].map(i => ({
      id: `s${i}`, day_of_week: i % 7, hour: 20, minute: 0, session_name: `S${i}`,
    }));
    const view = HomeView.render({ guild, cfg: {}, schedules, members: [], session: null });
    const desc = view.embeds[0].toJSON().description;
    expect(desc).toMatch(/5 lịch cố định/);
    expect(desc).toMatch(/và 2 lịch khác/);
  });

  it('config section hiển thị channel + phai + timezone', () => {
    const view = HomeView.render({
      guild,
      cfg: { log_channel_id: '123', timezone: 'Asia/Ho_Chi_Minh', phai_role_ids: ['r1', 'r2'] },
      schedules: [], members: [], session: null,
    });
    const desc = view.embeds[0].toJSON().description;
    expect(desc).toMatch(/<#123>/);
    expect(desc).toMatch(/<@&r1>/);
    expect(desc).toMatch(/<@&r2>/);
    expect(desc).toMatch(/Asia\/Ho_Chi_Minh/);
  });

  it('CUSTOM_ID đúng giá trị', () => {
    expect(CUSTOM_ID.HOME).toBe('setup:home');
    expect(CUSTOM_ID.REFRESH).toBe('setup:home:refresh');
    expect(CUSTOM_ID.CFG).toBe('setup:cfg');
    expect(CUSTOM_ID.SCH).toBe('setup:sch');
    expect(CUSTOM_ID.MEM).toBe('setup:mem');
    expect(CUSTOM_ID.SESSION).toBe('setup:session:close');
  });
});

describe('setupHome interaction handler', () => {
  it('parse: setup:home → match', () => {
    const h = new SetupHomeHandler({}, {});
    expect(h.parse({ customId: 'setup:home' })).toBeTruthy();
    expect(h.parse({ customId: 'setup:home:refresh' })).toBeTruthy();
  });

  it('parse: customId khác → none', () => {
    const h = new SetupHomeHandler({}, {});
    expect(h.parse({ customId: 'setup:session:close' })).toEqual({ none: true });
    expect(h.parse({ customId: 'attendance:join' })).toEqual({ none: true });
  });

  it('run: deferUpdate + editReply với Home dashboard', async () => {
    const h = new SetupHomeHandler({}, {});
    const updateMock = vi.fn().mockResolvedValue(null);
    const i = {
      customId: 'setup:home:refresh',
      guild: { id: 'g1', name: 'G', iconURL: () => null },
      deferUpdate: updateMock,
      editReply: vi.fn().mockResolvedValue(null),
    };
    await h.run(i);
    expect(updateMock).toHaveBeenCalled();
    expect(i.editReply).toHaveBeenCalledOnce();
    const arg = i.editReply.mock.calls[0][0];
    expect(arg.embeds).toHaveLength(1);
    expect(arg.components).toHaveLength(2);
  });
});

describe('setupSession interaction handler', () => {
  it('parse: setup:session:close → match', () => {
    const h = new SetupSessionHandler({}, {});
    expect(h.parse({ customId: 'setup:session:close' })).toBeTruthy();
  });

  it('parse: customId khác → none', () => {
    const h = new SetupSessionHandler({}, {});
    expect(h.parse({ customId: 'setup:home' })).toEqual({ none: true });
  });

  it('run: không có phiên active → editReply lỗi', async () => {
    mockGetActiveSession.mockResolvedValue(null);
    const h = new SetupSessionHandler({}, {});
    const i = {
      customId: 'setup:session:close',
      guild: { id: 'g1' },
      deferReply: vi.fn().mockResolvedValue(null),
      editReply: vi.fn().mockResolvedValue(null),
    };
    await h.run(i);
    expect(i.editReply).toHaveBeenCalled();
  });

  it('run: có phiên active → editReply với confirm dialog', async () => {
    mockGetActiveSession.mockResolvedValue({ id: 's1', session_name: 'Test' });
    const h = new SetupSessionHandler({}, {});
    const i = {
      customId: 'setup:session:close',
      guild: { id: 'g1' },
      deferReply: vi.fn().mockResolvedValue(null),
      editReply: vi.fn().mockResolvedValue(null),
    };
    await h.run(i);
    expect(i.editReply).toHaveBeenCalled();
  });
});
