// tests/smoke/lichcdDelete.test.js
// Test cho inline delete handler: lichcd:del:<scheduleId>
// (Commit 2: dùng table scheduled_sessions thay cho JSON cfg.schedules)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const mockDeleteScheduledSession = vi.fn();
const mockGetScheduledSessions   = vi.fn();
const mockBuildLichcdEmbed        = vi.fn().mockReturnValue({ _embed: 'rebuilt' });
const mockBuildScheduleDeleteRows = vi.fn().mockReturnValue([{ _row: 'new' }]);

function mockModule(modulePath, exports) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved, filename: resolved, loaded: true,
    exports, children: [], paths: [],
  };
}

mockModule('../../db.js', {
  deleteScheduledSession: (...a) => mockDeleteScheduledSession(...a),
  getScheduledSessions:   (...a) => mockGetScheduledSessions(...a),
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
  it('match lichcd:del:<id> với mọi id', () => {
    for (const id of ['lichcd:del:uuid-1', 'lichcd:del:abc-123']) {
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

  it('xóa schedule theo id, rebuild embed + rows từ table', async () => {
    mockDeleteScheduledSession.mockResolvedValue(null);
    mockGetScheduledSessions.mockResolvedValue([
      { id: 'uuid-1', day_of_week: 1, hour: 20, minute: 0, session_name: 'A' },
      { id: 'uuid-3', day_of_week: 5, hour: 22, minute: 0, session_name: 'C' },
    ]);
    const i = makeInteraction('lichcd:del:uuid-2');
    await handler.run(i);
    expect(mockDeleteScheduledSession).toHaveBeenCalledWith('uuid-2');
    expect(mockGetScheduledSessions).toHaveBeenCalledWith('g1');
    expect(mockBuildLichcdEmbed).toHaveBeenCalledWith(expect.any(Array));
    expect(i.editReply).toHaveBeenCalledOnce();
    const arg = i.editReply.mock.calls[0][0];
    expect(arg.embeds).toEqual([{ _embed: 'rebuilt' }]);
    expect(arg.components).toEqual([{ _row: 'new' }]);
    expect(i.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: '✅ Đã xóa lịch.',
      ephemeral: true,
    }));
  });

  it('deleteScheduledSession throw → followUp ephemeral error', async () => {
    mockDeleteScheduledSession.mockRejectedValue(new Error('db error'));
    const i = makeInteraction('lichcd:del:uuid-1');
    await handler.run(i);
    expect(i.editReply).not.toHaveBeenCalled();
    expect(i.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('Không thể xoá'),
      ephemeral: true,
    }));
  });

  it('customId không có id (empty) → silent return', async () => {
    const i = makeInteraction('lichcd:del:');
    await handler.run(i);
    expect(i.deferUpdate).toHaveBeenCalledOnce();
    expect(i.editReply).not.toHaveBeenCalled();
    expect(mockDeleteScheduledSession).not.toHaveBeenCalled();
  });

  it('sau khi xóa, lấy lại danh sách mới từ DB', async () => {
    mockDeleteScheduledSession.mockResolvedValue(null);
    const afterDelete = [{ id: 'uuid-2' }];
    mockGetScheduledSessions.mockResolvedValue(afterDelete);
    await handler.run(makeInteraction('lichcd:del:uuid-1'));
    expect(mockBuildLichcdEmbed).toHaveBeenCalledWith(afterDelete);
    expect(mockBuildScheduleDeleteRows).toHaveBeenCalledWith(afterDelete);
  });
});
