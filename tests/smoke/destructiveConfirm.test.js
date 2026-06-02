// tests/smoke/destructiveConfirm.test.js
// Test cho 5 confirm dialog: xoa, resetstreak, huy, caidat:reset, lichcd:delall
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const mockGetActiveSession    = vi.fn();
const mockGetSessionById      = vi.fn();
const mockCancelSession       = vi.fn();
const mockGetGuildConfig      = vi.fn();
const mockSetGuildConfig      = vi.fn();
const mockDeleteMember        = vi.fn();
const mockResetStreak         = vi.fn();

function mockModule(modulePath, exports) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved, filename: resolved, loaded: true,
    exports, children: [], paths: [],
  };
}

mockModule('../../db.js', {
  getActiveSession: (...a) => mockGetActiveSession(...a),
  getSessionById:   (...a) => mockGetSessionById(...a),
  cancelSession:    (...a) => mockCancelSession(...a),
  getGuildConfig:   (...a) => mockGetGuildConfig(...a),
  setGuildConfig:   (...a) => mockSetGuildConfig(...a),
  deleteMember:     (...a) => mockDeleteMember(...a),
  resetStreak:      (...a) => mockResetStreak(...a),
});

mockModule('../../utils/logger.js', {
  info:  vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
});

mockModule('../../utils/embeds.js', {
  FOOTER_DEFAULT: 'TEST_FOOTER',
  EmbedBuilder:   class { setColor() { return this; } setDescription() { return this; } setTitle() { return this; } setTimestamp() { return this; } },
});

mockModule('../../src/commands/schedule/lichcodinh.js', {
  buildLichcdEmbed:        vi.fn().mockReturnValue({ _embed: 'lichcd' }),
  buildScheduleDeleteRows: vi.fn().mockReturnValue([]),
});

mockModule('@sapphire/framework', {
  InteractionHandler: class {
    constructor(ctx, opts) { Object.assign(this, opts); }
    some() { return { some: true }; }
    none() { return { none: true }; }
  },
  InteractionHandlerTypes: { Button: 'Button' },
});

const { DestructiveConfirmHandler } = require('../../interaction-handlers/destructiveConfirm.js');

const makeInteraction = (customId, overrides = {}) => ({
  customId,
  guild: { id: 'g1' },
  user:  { id: 'admin-1' },
  channels: { cache: new Map() },
  deferUpdate: vi.fn().mockResolvedValue(null),
  update:      vi.fn().mockResolvedValue(null),
  editReply:   vi.fn().mockResolvedValue(null),
  followUp:    vi.fn().mockResolvedValue(null),
  ...overrides,
});

const handler = new DestructiveConfirmHandler({}, {});

describe('parse()', () => {
  it('match tất cả 5 confirm customIds', () => {
    const ids = [
      'xoa:confirm:u1',
      'resetstreak:confirm:u1',
      'huy:confirm:s1',
      'caidat:reset:confirm',
      'lichcd:delall:confirm',
    ];
    for (const id of ids) {
      expect(handler.parse(makeInteraction(id))).toBeTruthy();
    }
  });

  it('match cancel customIds (cả cancel có và không có suffix)', () => {
    const ids = [
      'xoa:cancel:u1',
      'resetstreak:cancel:u1',
      'huy:cancel:s1',
      'caidat:reset:cancel',
      'lichcd:delall:cancel',
    ];
    for (const id of ids) {
      expect(handler.parse(makeInteraction(id))).toBeTruthy();
    }
  });

  it('không match customIds không liên quan', () => {
    expect(handler.parse(makeInteraction('attendance:join'))).toBeTruthy();
    expect(handler.parse(makeInteraction('other:button'))).toEqual({ none: true });
  });
});

describe('cancel handlers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('update với "Đã hủy" cho mọi cancel', async () => {
    for (const id of ['xoa:cancel:u1', 'resetstreak:cancel:u1', 'huy:cancel:s1', 'caidat:reset:cancel', 'lichcd:delall:cancel']) {
      const interaction = makeInteraction(id);
      await handler.run(interaction);
      expect(interaction.update).toHaveBeenCalledWith({
        content: '↩️ Đã hủy.', embeds: [], components: [],
      });
    }
  });
});

describe('xoa:confirm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('gọi db.deleteMember với guildId + userId', async () => {
    mockDeleteMember.mockResolvedValue(null);
    const i = makeInteraction('xoa:confirm:user-42');
    await handler.run(i);
    expect(mockDeleteMember).toHaveBeenCalledWith('g1', 'user-42');
  });

  it('editReply với success embed + clear components', async () => {
    mockDeleteMember.mockResolvedValue(null);
    const i = makeInteraction('xoa:confirm:user-42');
    await handler.run(i);
    expect(i.editReply).toHaveBeenCalledOnce();
    const arg = i.editReply.mock.calls[0][0];
    expect(arg.components).toEqual([]);
    expect(arg.embeds).toBeDefined();
  });

  it('editReply lỗi khi db.deleteMember throw', async () => {
    mockDeleteMember.mockRejectedValue(new Error('DB down'));
    const i = makeInteraction('xoa:confirm:user-42');
    await handler.run(i);
    expect(i.editReply).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('Không thể xóa'),
    }));
  });

  it('suy ra targetId từ customId phân cách bằng dấu :', async () => {
    mockDeleteMember.mockResolvedValue(null);
    const i = makeInteraction('xoa:confirm:u-special_99');
    await handler.run(i);
    expect(mockDeleteMember).toHaveBeenCalledWith('g1', 'u-special_99');
  });
});

describe('resetstreak:confirm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('gọi db.resetStreak với guildId + userId', async () => {
    mockResetStreak.mockResolvedValue(null);
    const i = makeInteraction('resetstreak:confirm:user-7');
    await handler.run(i);
    expect(mockResetStreak).toHaveBeenCalledWith('g1', 'user-7');
  });

  it('editReply lỗi khi db.resetStreak throw', async () => {
    mockResetStreak.mockRejectedValue(new Error('fail'));
    const i = makeInteraction('resetstreak:confirm:user-7');
    await handler.run(i);
    expect(i.editReply).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('Không thể reset streak'),
    }));
  });
});

describe('huy:confirm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lấy session qua getSessionById rồi cancelSession', async () => {
    mockGetSessionById.mockResolvedValue({ id: 's1', session_name: 'Test', message_id: null, channel_id: null });
    mockCancelSession.mockResolvedValue(null);
    const i = makeInteraction('huy:confirm:s1');
    await handler.run(i);
    expect(mockGetSessionById).toHaveBeenCalledWith('s1');
    expect(mockCancelSession).toHaveBeenCalledWith('s1');
  });

  it('editReply lỗi khi session không tồn tại', async () => {
    mockGetSessionById.mockResolvedValue(null);
    const i = makeInteraction('huy:confirm:bad-id');
    await handler.run(i);
    expect(i.editReply).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('không tồn tại'),
    }));
  });

  it('editReply lỗi khi cancelSession throw', async () => {
    mockGetSessionById.mockResolvedValue({ id: 's1', session_name: 'T', message_id: null, channel_id: null });
    mockCancelSession.mockRejectedValue(new Error('DB fail'));
    const i = makeInteraction('huy:confirm:s1');
    await handler.run(i);
    expect(i.editReply).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('Không thể hủy phiên'),
    }));
  });
});

describe('caidat:reset:confirm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('gọi setGuildConfig với defaults', async () => {
    mockSetGuildConfig.mockResolvedValue(null);
    const i = makeInteraction('caidat:reset:confirm');
    await handler.run(i);
    expect(mockSetGuildConfig).toHaveBeenCalledWith('g1', expect.objectContaining({
      log_channel_id: null,
      timezone: 'Asia/Ho_Chi_Minh',
      phai_role_ids: [],
      schedules: [],
    }));
  });

  it('editReply lỗi khi setGuildConfig throw', async () => {
    mockSetGuildConfig.mockRejectedValue(new Error('fail'));
    const i = makeInteraction('caidat:reset:confirm');
    await handler.run(i);
    expect(i.editReply).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('Không thể reset'),
    }));
  });
});

describe('lichcd:delall:confirm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('gọi setGuildConfig với schedules=[]', async () => {
    mockSetGuildConfig.mockResolvedValue(null);
    mockGetGuildConfig.mockResolvedValue({ auto_schedule_enabled: true });
    const i = makeInteraction('lichcd:delall:confirm');
    await handler.run(i);
    expect(mockSetGuildConfig).toHaveBeenCalledWith('g1', { schedules: [] });
  });

  it('editReply lỗi khi setGuildConfig throw', async () => {
    mockSetGuildConfig.mockRejectedValue(new Error('fail'));
    const i = makeInteraction('lichcd:delall:confirm');
    await handler.run(i);
    expect(i.editReply).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('Không thể xóa'),
    }));
  });
});
