import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const mockGetActiveSession  = vi.fn();
const mockCloseSession      = vi.fn();
const mockGetAttendances    = vi.fn();
const mockStopAutoRefresh   = vi.fn();
const mockXoaHenGio         = vi.fn();
const mockKetThucPhien      = vi.fn().mockResolvedValue(new Map());
const mockVoHieuHoa         = vi.fn();
const mockBuildSummaryEmbed = vi.fn().mockReturnValue({ _embed: 'summary' });
const mockThongBaoHuyHieu   = vi.fn().mockResolvedValue(null);
const mockBuildAdminMarkModal = vi.fn();

function mockModule(modulePath, exports) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved, filename: resolved, loaded: true,
    exports, children: [], paths: [],
  };
}

mockModule('../../db.js', {
  getActiveSession: mockGetActiveSession,
  closeSession:     mockCloseSession,
  getAttendances:   mockGetAttendances,
  getGuildConfig:   vi.fn().mockResolvedValue({}),
});
mockModule('../../utils/timers.js', {
  stopAutoRefresh: mockStopAutoRefresh,
  xoaHenGio:       mockXoaHenGio,
});
mockModule('../../utils/session.js', {
  ketThucPhien:         mockKetThucPhien,
  voHieuHoaNutDiemDanh: mockVoHieuHoa,
  thongBaoHuyHieu:      mockThongBaoHuyHieu,
});
mockModule('../../utils/embeds.js', {
  buildSummaryEmbed:    mockBuildSummaryEmbed,
  FOOTER_DEFAULT:       'Test',
  buildSessionEmbed:    vi.fn().mockResolvedValue({ embed: { _embed: 'session' } }),
  buildSessionActionRow: vi.fn().mockReturnValue([]),
  replyOkEdit:          vi.fn().mockReturnValue({ content: '✅' }),
  replyErrEdit:         vi.fn().mockReturnValue({ content: '🚫' }),
  replyConfirm:         vi.fn().mockReturnValue({ embeds: [], components: [] }),
});
mockModule('../../utils/permissions.js', {
  requireAdmin: vi.fn().mockResolvedValue({ ok: true }),
});
mockModule('../../utils/logger.js', {
  info: vi.fn(), warn: vi.fn(), error: vi.fn(),
});
mockModule('../../utils/adminMarkModal.js', {
  buildAdminMarkModal: mockBuildAdminMarkModal,
});
mockModule('../../utils/csvHelper.js', {
  buildCsvBuffer:   vi.fn().mockReturnValue(Buffer.from('')),
  buildCsvFilename: vi.fn().mockReturnValue('test.csv'),
});
mockModule('../../utils/sentry.js', {
  addBreadcrumb: vi.fn(),
});

mockModule('@sapphire/framework', {
  InteractionHandler: class {
    constructor(ctx, opts) { Object.assign(this, opts); }
    some() { return { some: true }; }
    none() { return { none: true }; }
  },
  InteractionHandlerTypes: { Button: 'Button' },
});

const { SessionButtonHandler } = require('../../interaction-handlers/sessionButton.js');

const SESSION = { id: 'sess-1', session_name: 'TestPhien', guild_id: 'g1' };
const handler = new SessionButtonHandler({}, {});

function makeInteraction(customId, overrides = {}) {
  return {
    customId,
    guild: { id: 'g1' },
    channel: { id: 'ch1', send: vi.fn().mockResolvedValue(null) },
    client: {},
    deferUpdate: vi.fn().mockResolvedValue(null),
    editReply: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('SessionButton confirm_close flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('confirm_close → gọi db.closeSession (KHÔNG endSession)', async () => {
    mockGetActiveSession.mockResolvedValue(SESSION);
    mockCloseSession.mockResolvedValue(SESSION);
    mockGetAttendances.mockResolvedValue([]);
    await handler.run(makeInteraction('session:confirm_close'));
    expect(mockCloseSession).toHaveBeenCalledOnce();
    expect(mockCloseSession).toHaveBeenCalledWith('sess-1');
  });

  it('confirm_close → gửi summary embed ra channel', async () => {
    mockGetActiveSession.mockResolvedValue(SESSION);
    mockCloseSession.mockResolvedValue(SESSION);
    mockGetAttendances.mockResolvedValue([]);
    await handler.run(makeInteraction('session:confirm_close'));
    expect(mockBuildSummaryEmbed).toHaveBeenCalledWith(SESSION, [], expect.any(Object), []);
  });

  it('cancel_close → update with cancelled message', async () => {
    const i = makeInteraction('session:cancel_close');
    await handler.run(i);
    expect(i.update).toHaveBeenCalled();
    expect(mockCloseSession).not.toHaveBeenCalled();
  });

  it('không có phiên → editReply lỗi', async () => {
    mockGetActiveSession.mockResolvedValue(null);
    await handler.run(makeInteraction('session:confirm_close'));
    expect(mockCloseSession).not.toHaveBeenCalled();
  });

  it('closeSession throw → editReply lỗi', async () => {
    mockGetActiveSession.mockResolvedValue(SESSION);
    mockCloseSession.mockRejectedValue(new Error('DB down'));
    await handler.run(makeInteraction('session:confirm_close'));
    expect(mockCloseSession).toHaveBeenCalled();
  });

  it('gọi stopAutoRefresh và xoaHenGio khi close', async () => {
    mockGetActiveSession.mockResolvedValue(SESSION);
    mockCloseSession.mockResolvedValue(SESSION);
    mockGetAttendances.mockResolvedValue([]);
    await handler.run(makeInteraction('session:confirm_close'));
    expect(mockStopAutoRefresh).toHaveBeenCalledWith('sess-1');
    expect(mockXoaHenGio).toHaveBeenCalledWith('g1');
  });
});
