// tests/smoke/ketthuc.test.js
// Regression: /ket_thuc used to call db.endSession() (không tồn tại)
// phải gọi db.closeSession() — bug này gây TypeError khi admin kết thúc phiên
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const mockGetGuildConfig      = vi.fn();
const mockGetActiveSession    = vi.fn();
const mockCloseSession        = vi.fn();
const mockEndSession          = vi.fn();
const mockGetAttendances      = vi.fn();
const mockBuildSummaryEmbed   = vi.fn().mockReturnValue({ _embed: 'summary' });

function mockModule(modulePath, exports) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved, filename: resolved, loaded: true,
    exports, children: [], paths: [],
  };
}

mockModule('../../db.js', {
  getGuildConfig:   mockGetGuildConfig,
  getActiveSession: mockGetActiveSession,
  closeSession:     mockCloseSession,
  endSession:       mockEndSession,
  getAttendances:   mockGetAttendances,
});

mockModule('../../utils/embeds.js', {
  FOOTER_DEFAULT:  'Test · Bot',
  buildSummaryEmbed: mockBuildSummaryEmbed,
  replyWarnEdit:   (msg) => ({ content: msg }),
});

mockModule('@sapphire/framework', {
  Command: class { constructor(ctx, opts) { Object.assign(this, opts); } },
});

const { KetThucCommand } = require('../../src/commands/session/ketthuc.js');

const SESSION = { id: 'sess-1', session_name: 'TestPhien', guild_id: 'g1' };

const makeInteraction = (overrides = {}) => ({
  guild: { id: 'g1' },
  deferReply: vi.fn().mockResolvedValue(null),
  editReply:  vi.fn().mockResolvedValue(null),
  channel:    { id: 'ch1', send: vi.fn().mockResolvedValue(null) },
  ...overrides,
});

const command = new KetThucCommand({});

describe('/ket_thuc — regression db.endSession → db.closeSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGuildConfig.mockResolvedValue({ log_channel_id: null, phai_role_ids: [] });
    mockGetAttendances.mockResolvedValue([]);
  });

  it('gọi db.closeSession (KHÔNG gọi db.endSession)', async () => {
    mockGetActiveSession.mockResolvedValue(SESSION);
    mockCloseSession.mockResolvedValue(SESSION);
    const i = makeInteraction();
    await command.chatInputRun(i);
    expect(mockCloseSession).toHaveBeenCalledOnce();
    expect(mockCloseSession).toHaveBeenCalledWith('sess-1');
    expect(mockEndSession).not.toHaveBeenCalled();
  });

  it('trả về embed summary sau khi close', async () => {
    mockGetActiveSession.mockResolvedValue(SESSION);
    mockCloseSession.mockResolvedValue(SESSION);
    const i = makeInteraction();
    await command.chatInputRun(i);
    expect(mockBuildSummaryEmbed).toHaveBeenCalledWith(
      SESSION, [], i.guild, null,
    );
    expect(i.editReply).toHaveBeenCalledWith({ embeds: [{ _embed: 'summary' }] });
  });

  it('không có phiên → reply warn, KHÔNG gọi closeSession', async () => {
    mockGetActiveSession.mockResolvedValue(null);
    const i = makeInteraction();
    await command.chatInputRun(i);
    expect(mockCloseSession).not.toHaveBeenCalled();
    expect(i.editReply).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('Không có phiên'),
    }));
  });

  it('closeSession throw → exception bubbles lên commandError listener', async () => {
    mockGetActiveSession.mockResolvedValue(SESSION);
    mockCloseSession.mockRejectedValue(new Error('DB down'));
    const i = makeInteraction();
    await expect(command.chatInputRun(i)).rejects.toThrow('DB down');
  });

  it('gửi embed tới log_channel nếu có config', async () => {
    mockGetGuildConfig.mockResolvedValue({ log_channel_id: 'log-ch', phai_role_ids: [] });
    mockGetActiveSession.mockResolvedValue(SESSION);
    mockCloseSession.mockResolvedValue(SESSION);
    const logCh = { send: vi.fn().mockResolvedValue(null) };
    const i = makeInteraction({ guild: { id: 'g1', channels: { cache: new Map([['log-ch', logCh]]) } } });
    await command.chatInputRun(i);
    expect(logCh.send).toHaveBeenCalledWith({ embeds: [{ _embed: 'summary' }] });
  });
});
