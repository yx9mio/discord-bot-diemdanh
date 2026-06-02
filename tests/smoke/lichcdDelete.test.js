// tests/smoke/lichcdDelete.test.js
// Test cho inline delete handler: lichcd:del:<idx>
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const mockGetGuildConfig = vi.fn();
const mockSetGuildConfig = vi.fn();
const mockBuildLichcdEmbed = vi.fn().mockReturnValue({ _embed: 'rebuilt' });
const mockBuildScheduleDeleteRows = vi.fn().mockReturnValue([{ _row: 'new' }]);

function mockModule(modulePath, exports) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved, filename: resolved, loaded: true,
    exports, children: [], paths: [],
  };
}

mockModule('../../db.js', {
  getGuildConfig: (...a) => mockGetGuildConfig(...a),
  setGuildConfig: (...a) => mockSetGuildConfig(...a),
});

mockModule('../../utils/logger.js', {
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
});

mockModule('../../src/commands/schedule/lichcodinh.js', {
  buildLichcdEmbed:        mockBuildLichcdEmbed,
  buildScheduleDeleteRows: mockBuildScheduleDeleteRows,
});

mockModule('@sapphire/framework', {
  InteractionHandler: class {
    constructor(ctx, opts) { Object.assign(this, opts); }
    some() { return { some: true }; }
    none() { return { none: true }; }
  },
  InteractionHandlerTypes: { Button: 'Button' },
});

const { LichcdDeleteHandler } = require('../../interaction-handlers/lichcdDelete.js');

const makeInteraction = (customId, overrides = {}) => ({
  customId,
  guild: { id: 'g1' },
  deferUpdate: vi.fn().mockResolvedValue(null),
  editReply:   vi.fn().mockResolvedValue(null),
  followUp:    vi.fn().mockResolvedValue(null),
  ...overrides,
});

const handler = new LichcdDeleteHandler({}, {});

describe('parse()', () => {
  it('match lichcd:del:<idx> với mọi index', () => {
    for (const id of ['lichcd:del:0', 'lichcd:del:1', 'lichcd:del:99']) {
      expect(handler.parse(makeInteraction(id))).toBeTruthy();
    }
  });

  it('không match customIds khác', () => {
    expect(handler.parse(makeInteraction('lichcd:delall:confirm'))).toEqual({ none: true });
    expect(handler.parse(makeInteraction('attendance:join'))).toEqual({ none: true });
  });
});

describe('run()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('xóa schedule tại idx, save DB, rebuild embed + rows', async () => {
    mockGetGuildConfig.mockResolvedValue({
      schedules: [
        { day_of_week: 1, hour: 20, minute: 0, session_name: 'A' },
        { day_of_week: 3, hour: 21, minute: 0, session_name: 'B' },
        { day_of_week: 5, hour: 22, minute: 0, session_name: 'C' },
      ],
      auto_schedule_enabled: true,
    });
    mockSetGuildConfig.mockResolvedValue(null);
    const i = makeInteraction('lichcd:del:1');
    await handler.run(i);
    expect(mockSetGuildConfig).toHaveBeenCalledWith('g1', {
      schedules: [
        { day_of_week: 1, hour: 20, minute: 0, session_name: 'A' },
        { day_of_week: 5, hour: 22, minute: 0, session_name: 'C' },
      ],
    });
    expect(mockBuildLichcdEmbed).toHaveBeenCalledWith(
      expect.any(Array),
      true,
    );
    expect(i.editReply).toHaveBeenCalledOnce();
    const arg = i.editReply.mock.calls[0][0];
    expect(arg.embeds).toEqual([{ _embed: 'rebuilt' }]);
    expect(arg.components).toEqual([{ _row: 'new' }]);
    expect(i.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: '✅ Đã xóa lịch.',
      ephemeral: true,
    }));
  });

  it('idx ngoài range → followUp ephemeral warning', async () => {
    mockGetGuildConfig.mockResolvedValue({ schedules: [{ day_of_week: 1, hour: 20, minute: 0 }] });
    const i = makeInteraction('lichcd:del:5');
    await handler.run(i);
    expect(i.editReply).not.toHaveBeenCalled();
    expect(i.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('đã bị xóa trước đó'),
      ephemeral: true,
    }));
  });

  it('idx âm → followUp warning', async () => {
    mockGetGuildConfig.mockResolvedValue({ schedules: [{ day_of_week: 1, hour: 20, minute: 0 }] });
    const i = makeInteraction('lichcd:del:-1');
    await handler.run(i);
    expect(i.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('đã bị xóa trước đó'),
    }));
  });

  it('schedules rỗng → followUp warning', async () => {
    mockGetGuildConfig.mockResolvedValue({ schedules: [] });
    const i = makeInteraction('lichcd:del:0');
    await handler.run(i);
    expect(i.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('đã bị xóa trước đó'),
    }));
  });

  it('customId không phải số → không làm gì (silent return)', async () => {
    const i = makeInteraction('lichcd:del:abc');
    await handler.run(i);
    expect(i.deferUpdate).toHaveBeenCalledOnce();
    expect(i.editReply).not.toHaveBeenCalled();
    expect(mockGetGuildConfig).not.toHaveBeenCalled();
  });

  it('truyền auto_schedule_enabled=false vào buildLichcdEmbed', async () => {
    mockGetGuildConfig.mockResolvedValue({
      schedules: [{ day_of_week: 1, hour: 20, minute: 0 }, { day_of_week: 3, hour: 21, minute: 0 }],
      auto_schedule_enabled: false,
    });
    mockSetGuildConfig.mockResolvedValue(null);
    await handler.run(makeInteraction('lichcd:del:0'));
    expect(mockBuildLichcdEmbed).toHaveBeenCalledWith(expect.any(Array), false);
  });
});
