// tests/unit/adminMarkModal.test.js
// [D3] Unit tests cho adminMarkModal handler
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const mockGetActiveSession = vi.fn();
const mockUpsertAttendance = vi.fn();

function mockModule(modulePath, exports) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved, filename: resolved, loaded: true,
    exports, children: [], paths: [],
  };
}

mockModule('../../db.js', {
  getActiveSession: (...a) => mockGetActiveSession(...a),
  upsertAttendance: (...a) => mockUpsertAttendance(...a),
});

mockModule('../../utils/permissions.js', {
  requireAdmin: vi.fn().mockResolvedValue({ ok: true }),
});

mockModule('../../utils/sentry.js', {
  addBreadcrumb: vi.fn(),
});

mockModule('../../utils/logger.js', {
  info: vi.fn(), warn: vi.fn(), error: vi.fn(),
});

mockModule('@sapphire/framework', {
  InteractionHandler: class {
    constructor(ctx, opts) { Object.assign(this, opts); }
    some() { return { some: true }; }
    none() { return { none: true }; }
  },
  InteractionHandlerTypes: { ModalSubmit: 'ModalSubmit' },
});

const { AdminMarkModalHandler } = require('../../interaction-handlers/adminMarkModal.js');

const makeSession = () => ({
  id: 'sess-1',
  session_name: 'Test',
});

const makeInteraction = (fields, overrides = {}) => ({
  customId: 'admin:mark:modal',
  guild: {
    id: 'g1',
    members: {
      fetch: vi.fn().mockResolvedValue({
        user: { bot: false, username: 'bob' },
        nickname: null,
        displayName: 'Bob',
      }),
    },
  },
  user: { id: 'admin-1', tag: 'Admin#0001' },
  fields: {
    getTextInputValue: (id) => fields[id],
  },
  deferReply: vi.fn().mockResolvedValue(null),
  editReply:  vi.fn().mockResolvedValue(null),
  ...overrides,
});

const handler = new AdminMarkModalHandler({}, {});

describe('parse()', () => {
  it('nhận admin:mark:modal', () => {
    expect(handler.parse({ customId: 'admin:mark:modal' })).toBeTruthy();
  });
});

describe('run() — thành công', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSession.mockResolvedValue(makeSession());
    mockUpsertAttendance.mockResolvedValue({});
  });

  it('upsertAttendance với marked_by là admin', async () => {
    await handler.run(makeInteraction({ user_id: '999', status: 'tham_gia' }));
    expect(mockUpsertAttendance).toHaveBeenCalledOnce();
    const payload = mockUpsertAttendance.mock.calls[0][0];
    expect(payload).toMatchObject({
      session_id: 'sess-1',
      guild_id:   'g1',
      user_id:    '999',
      status:     'tham_gia',
      marked_by:  'admin-1',
    });
  });
});

describe('run() — không có phiên', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSession.mockResolvedValue(null);
  });

  it('editReply thông báo không có phiên', async () => {
    const interaction = makeInteraction({ user_id: '999', status: 'tham_gia' });
    await handler.run(interaction);
    expect(mockUpsertAttendance).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Không có phiên') }),
    );
  });
});

describe('run() — không có quyền admin', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const perms = require('../../utils/permissions.js');
    perms.requireAdmin.mockResolvedValueOnce({ ok: false });
    mockGetActiveSession.mockResolvedValue(makeSession());
  });

  it('không gọi upsertAttendance', async () => {
    await handler.run(makeInteraction({ user_id: '999', status: 'tre' }));
    expect(mockUpsertAttendance).not.toHaveBeenCalled();
  });
});
