// tests/smoke/sessionClose.test.js
// Smoke test: BUG-8 regression — closeSession throw → abort, không gửi embed
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const mockDb = {
  getActiveSession: vi.fn(),
  closeSession: vi.fn(),
  getAttendances: vi.fn().mockResolvedValue([]),
};
const mockKetThucPhien   = vi.fn().mockResolvedValue(new Map());
const mockThongBao       = vi.fn().mockResolvedValue(undefined);
const mockVoHieuHoa      = vi.fn().mockResolvedValue(undefined);
const mockBuildSummary   = vi.fn().mockReturnValue({});
const mockXoaHenGio      = vi.fn();
const mockRequireAdmin   = vi.fn().mockResolvedValue({ ok: true });

// Pre-populate require.cache cho SUT dependencies (CJS). Workaround vì
// vi.mock() không intercept require() trong module CJS khi test file là ESM.
function mockModule(modulePath, exports) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved, filename: resolved, loaded: true,
    exports, children: [], paths: [],
  };
}

mockModule('../../db.js', mockDb);
mockModule('../../utils/session.js', {
  ketThucPhien:          mockKetThucPhien,
  thongBaoHuyHieu:       mockThongBao,
  voHieuHoaNutDiemDanh:  mockVoHieuHoa,
});
mockModule('../../utils/embeds.js', {
  buildSummaryEmbed:     mockBuildSummary,
  replyErrEdit:          (msg) => ({ content: msg }),
  replyOkEdit:           (msg) => ({ content: msg }),
  replyConfirm:          vi.fn().mockReturnValue({}),
  buildSessionEmbed:     vi.fn().mockReturnValue({ embed: {}, components: [] }),
  buildAttendanceButtons: vi.fn().mockReturnValue([]),
  buildConfigEmbed:      vi.fn().mockReturnValue({}),
});
mockModule('../../utils/timers.js', { xoaHenGio: mockXoaHenGio });
mockModule('../../utils/permissions.js', { requireAdmin: mockRequireAdmin });

const { SessionButtonHandler } = require('../../interaction-handlers/sessionButton.js');

const SESSION = { id: 'sess1', session_name: 'TestPhien', guild_id: 'g1' };

function makeInteraction(customId) {
  const ch = {
    send: vi.fn().mockResolvedValue(undefined),
    messages: { fetch: vi.fn().mockResolvedValue(null) },
  };
  return {
    customId,
    guild: { id: 'g1', channels: { cache: new Map() } },
    channel: ch,
    user: { id: 'u_admin' },
    deferUpdate:  vi.fn().mockResolvedValue(undefined),
    deferReply:   vi.fn().mockResolvedValue(undefined),
    editReply:    vi.fn().mockResolvedValue(undefined),
    update:       vi.fn().mockResolvedValue(undefined),
    followUp:     vi.fn().mockResolvedValue(undefined),
    reply:        vi.fn().mockResolvedValue(undefined),
    client:       {},
  };
}

describe('SessionButton confirm_close — BUG-8 regression', () => {
  beforeEach(() => vi.clearAllMocks());

  it('closeSession throw → editReply lỗi, KHÔNG gọi ketThucPhien', async () => {
    mockDb.getActiveSession.mockResolvedValue(SESSION);
    mockDb.closeSession.mockRejectedValue(new Error('DB timeout'));

    const handler = { run: SessionButtonHandler.prototype.run };
    const interaction = makeInteraction('session:confirm_close');

    await handler.run.call(handler, interaction);

    expect(mockKetThucPhien).not.toHaveBeenCalled(); // BUG-8 regression
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('lỗi DB') })
    );
  });

  it('closeSession thành công → ketThucPhien được gọi', async () => {
    mockDb.getActiveSession.mockResolvedValue(SESSION);
    mockDb.closeSession.mockResolvedValue({ ...SESSION, is_active: false });

    const handler = { run: SessionButtonHandler.prototype.run };
    const interaction = makeInteraction('session:confirm_close');

    await handler.run.call(handler, interaction);

    expect(mockKetThucPhien).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('thành công') })
    );
  });

  it('không có phiên → editReply lỗi, không làm gì thêm', async () => {
    mockDb.getActiveSession.mockResolvedValue(null);

    const handler = { run: SessionButtonHandler.prototype.run };
    const interaction = makeInteraction('session:confirm_close');

    await handler.run.call(handler, interaction);

    expect(mockDb.closeSession).not.toHaveBeenCalled();
  });
});
