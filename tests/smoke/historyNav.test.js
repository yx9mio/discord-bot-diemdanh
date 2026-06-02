// tests/smoke/historyNav.test.js
// Test cho pagination handler: history:prev, history:next
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const mockGetSessionHistory = vi.fn();
const mockBuildHistoryNavRow = vi.fn().mockReturnValue({ _row: 'nav' });

function mockModule(modulePath, exports) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved, filename: resolved, loaded: true,
    exports, children: [], paths: [],
  };
}

mockModule('../../db.js', {
  getSessionHistory: (...a) => mockGetSessionHistory(...a),
});

mockModule('../../utils/embeds.js', {
  buildHistoryNavRow: mockBuildHistoryNavRow,
});

mockModule('../../src/commands/stats/lichsu.js', {
  buildHistoryEmbed: (sessions, page, totalPages, scope) => ({
    _embed: true, _sessions: sessions, _page: page, _totalPages: totalPages, _scope: scope,
  }),
  PAGE_SIZE: 10,
});

mockModule('@sapphire/framework', {
  InteractionHandler: class {
    constructor(ctx, opts) { Object.assign(this, opts); }
    some() { return { some: true }; }
    none() { return { none: true }; }
  },
  InteractionHandlerTypes: { Button: 'Button' },
});

const { HistoryNavHandler } = require('../../interaction-handlers/historyNav.js');

const makeInteraction = (customId, embeds = [], overrides = {}) => ({
  customId,
  guild:   { id: 'g1' },
  message: { embeds },
  deferUpdate: vi.fn().mockResolvedValue(null),
  editReply:   vi.fn().mockResolvedValue(null),
  ...overrides,
});

const makeHistoryEmbed = (page, totalPages) => ({
  footer: { text: `Trang ${page}/${totalPages} · 50 phiên gần nhất` },
});

const handler = new HistoryNavHandler({}, {});

describe('parse()', () => {
  it('match history:prev và history:next', () => {
    expect(handler.parse(makeInteraction('history:prev'))).toBeTruthy();
    expect(handler.parse(makeInteraction('history:next'))).toBeTruthy();
  });

  it('không match customIds khác', () => {
    expect(handler.parse(makeInteraction('attendance:join'))).toEqual({ none: true });
    expect(handler.parse(makeInteraction('lichsu:prev'))).toEqual({ none: true });
  });
});

describe('run()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('next: parse page từ footer rồi tăng lên 1', async () => {
    mockGetSessionHistory.mockResolvedValue(Array.from({ length: 30 }, (_, i) => ({ id: 's' + i })));
    const i = makeInteraction('history:next', [makeHistoryEmbed(1, 3)]);
    await handler.run(i);
    expect(mockGetSessionHistory).toHaveBeenCalledWith('g1', 100);
    expect(i.editReply).toHaveBeenCalledOnce();
    const arg = i.editReply.mock.calls[0][0];
    expect(arg.embeds[0]._page).toBe(1);
    expect(arg.embeds[0]._totalPages).toBe(3);
  });

  it('prev: giảm page 1', async () => {
    mockGetSessionHistory.mockResolvedValue(Array.from({ length: 30 }, (_, i) => ({ id: 's' + i })));
    const i = makeInteraction('history:prev', [makeHistoryEmbed(2, 3)]);
    await handler.run(i);
    const arg = i.editReply.mock.calls[0][0];
    expect(arg.embeds[0]._page).toBe(0);
  });

  it('không vượt quá totalPages (clamp)', async () => {
    mockGetSessionHistory.mockResolvedValue(Array.from({ length: 30 }, (_, i) => ({ id: 's' + i })));
    const i = makeInteraction('history:next', [makeHistoryEmbed(3, 3)]);
    await handler.run(i);
    const arg = i.editReply.mock.calls[0][0];
    expect(arg.embeds[0]._page).toBe(2);
  });

  it('không xuống dưới 0 (clamp)', async () => {
    mockGetSessionHistory.mockResolvedValue(Array.from({ length: 30 }, (_, i) => ({ id: 's' + i })));
    const i = makeInteraction('history:prev', [makeHistoryEmbed(1, 3)]);
    await handler.run(i);
    const arg = i.editReply.mock.calls[0][0];
    expect(arg.embeds[0]._page).toBe(0);
  });

  it('reply "Chưa có phiên nào" khi DB trống', async () => {
    mockGetSessionHistory.mockResolvedValue([]);
    const i = makeInteraction('history:next', [makeHistoryEmbed(1, 1)]);
    await handler.run(i);
    expect(i.editReply).toHaveBeenCalledWith(expect.objectContaining({
      content: 'Chưa có phiên nào.',
      embeds: [],
      components: [],
    }));
  });

  it('không có nav row khi totalPages = 1', async () => {
    mockGetSessionHistory.mockResolvedValue([{ id: 's1' }]);
    const i = makeInteraction('history:next', [makeHistoryEmbed(1, 1)]);
    await handler.run(i);
    const arg = i.editReply.mock.calls[0][0];
    expect(arg.components).toEqual([]);
  });

  it('có nav row khi totalPages > 1', async () => {
    mockGetSessionHistory.mockResolvedValue(Array.from({ length: 25 }, (_, i) => ({ id: 's' + i })));
    const i = makeInteraction('history:next', [makeHistoryEmbed(1, 3)]);
    await handler.run(i);
    const arg = i.editReply.mock.calls[0][0];
    expect(arg.components).toEqual([{ _row: 'nav' }]);
    expect(mockBuildHistoryNavRow).toHaveBeenCalledWith(2, 3);
  });

  it('parse page 0 khi footer không match pattern', async () => {
    mockGetSessionHistory.mockResolvedValue(Array.from({ length: 30 }, (_, i) => ({ id: 's' + i })));
    const i = makeInteraction('history:prev', [{ footer: { text: 'some other footer' } }]);
    await handler.run(i);
    const arg = i.editReply.mock.calls[0][0];
    expect(arg.embeds[0]._page).toBe(0);
  });

  it('parse page 0 khi không có embeds', async () => {
    mockGetSessionHistory.mockResolvedValue(Array.from({ length: 30 }, (_, i) => ({ id: 's' + i })));
    const i = makeInteraction('history:next', []);
    await handler.run(i);
    const arg = i.editReply.mock.calls[0][0];
    expect(arg.embeds[0]._page).toBe(1);
  });
});
