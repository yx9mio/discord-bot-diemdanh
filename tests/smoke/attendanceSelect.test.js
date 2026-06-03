// tests/smoke/attendanceSelect.test.js
// [B1] Test cho attendanceSelect handler (StringSelectMenu thay thế button)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const mockGetActiveSession = vi.fn();
const mockUpsertAttendance = vi.fn();
const mockGetAttendances   = vi.fn();

function mockModule(modulePath, exports) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved, filename: resolved, loaded: true,
    exports, children: [], paths: [],
  };
}

mockModule('../../db.js', {
  getActiveSession:           (...a) => mockGetActiveSession(...a),
  upsertAttendance:           (...a) => mockUpsertAttendance(...a),
  getAttendances:             (...a) => mockGetAttendances(...a),
  getStreak:                  vi.fn().mockResolvedValue(null),
  tryAcquireAttendanceLock:   vi.fn().mockResolvedValue(true),
  releaseAttendanceLock:      vi.fn().mockResolvedValue(true),
});

mockModule('../../utils/embeds.js', {
  buildSessionEmbed:       vi.fn().mockReturnValue({ embed: { _embed: true }, components: [] }),
  buildSessionActionRow:   vi.fn().mockReturnValue([]),
  buildAttendConfirmEmbed: vi.fn().mockReturnValue({ embeds: [], flags: 64 }),
});

mockModule('@sapphire/framework', {
  InteractionHandler: class {
    constructor(ctx, opts) { Object.assign(this, opts); }
    some() { return { some: true }; }
    none() { return { none: true }; }
  },
  InteractionHandlerTypes: { StringSelect: 'StringSelect' },
});

const { AttendanceSelectHandler } = require('../../interaction-handlers/attendanceSelect.js');

const makeInteraction = (customId, values = ['tham_gia'], overrides = {}) => ({
  customId,
  values,
  guild: {
    id: 'g1',
    channels: { cache: new Map() },
    roles:    { cache: new Map() },
  },
  member: {
    nickname: null,
    displayName: 'Alice',
    roles: { cache: new Map() },
  },
  user: { id: 'u1', displayName: 'Alice', username: 'alice' },
  reply:      vi.fn().mockResolvedValue(null),
  deferReply: vi.fn().mockResolvedValue(null),
  editReply:  vi.fn().mockResolvedValue(null),
  ...overrides,
});

const makeSession = (extra = {}) => ({
  id: 'sess-1',
  name: 'Phiên Test',
  channel_id: 'ch1',
  message_id: 'msg1',
  eligible_member_ids: null,
  allowed_role_id: null,
  phai_role_ids: [],
  ...extra,
});

const handler = new AttendanceSelectHandler({}, {});

describe('parse()', () => {
  it('trả về some() cho customId attendance:select', () => {
    const result = handler.parse(makeInteraction('attendance:select'));
    expect(result).toBeTruthy();
  });

  it('không throw cho customId không liên quan', () => {
    expect(() => handler.parse(makeInteraction('other:select'))).not.toThrow();
  });
});

describe('run() — không có session active', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSession.mockResolvedValue(null);
  });

  it('reply ephemeral với thông báo không có phiên', async () => {
    const interaction = makeInteraction('attendance:select');
    await handler.run(interaction);
    expect(interaction.reply).toHaveBeenCalledOnce();
    const arg = interaction.reply.mock.calls[0][0];
    expect(arg.ephemeral).toBe(true);
    expect(arg.content).toContain('Không có phiên');
  });

  it('KHÔNG gọi deferReply khi không có session', async () => {
    const interaction = makeInteraction('attendance:select');
    await handler.run(interaction);
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });
});

describe('run() — điểm danh thành công', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSession.mockResolvedValue(makeSession());
    mockUpsertAttendance.mockResolvedValue(null);
    mockGetAttendances.mockResolvedValue([]);
  });

  it('gọi upsertAttendance với đúng payload shape', async () => {
    await handler.run(makeInteraction('attendance:select', ['tham_gia']));
    expect(mockUpsertAttendance).toHaveBeenCalledOnce();
    const payload = mockUpsertAttendance.mock.calls[0][0];
    expect(payload).toMatchObject({
      session_id: 'sess-1',
      guild_id:   'g1',
      user_id:    'u1',
      status:     'tham_gia',
    });
  });

  it('status đúng cho từng option', async () => {
    const map = {
      'tham_gia':       'tham_gia',
      'tre':            'tre',
      'khong_tham_gia': 'khong_tham_gia',
      'co_phep':        'co_phep',
    };
    for (const [value, expectedStatus] of Object.entries(map)) {
      vi.clearAllMocks();
      mockGetActiveSession.mockResolvedValue(makeSession());
      mockUpsertAttendance.mockResolvedValue(null);
      mockGetAttendances.mockResolvedValue([]);
      await handler.run(makeInteraction('attendance:select', [value]));
      expect(mockUpsertAttendance.mock.calls[0][0].status).toBe(expectedStatus);
    }
  });

  it('gọi deferReply ephemeral trước khi xử lý', async () => {
    const interaction = makeInteraction('attendance:select');
    await handler.run(interaction);
    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
  });

  it('gọi editReply sau khi xong', async () => {
    const interaction = makeInteraction('attendance:select');
    await handler.run(interaction);
    expect(interaction.editReply).toHaveBeenCalledOnce();
  });
});

describe('run() — eligible_member_ids filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsertAttendance.mockResolvedValue(null);
    mockGetAttendances.mockResolvedValue([]);
  });

  it('block user không trong danh sách eligible', async () => {
    mockGetActiveSession.mockResolvedValue(makeSession({ eligible_member_ids: ['other_user'] }));
    await handler.run(makeInteraction('attendance:select'));
    expect(mockUpsertAttendance).not.toHaveBeenCalled();
  });

  it('cho phép user có trong danh sách eligible', async () => {
    mockGetActiveSession.mockResolvedValue(makeSession({ eligible_member_ids: ['u1'] }));
    await handler.run(makeInteraction('attendance:select'));
    expect(mockUpsertAttendance).toHaveBeenCalledOnce();
  });
});

describe('run() — allowed_role_id filter', () => {
  it('block user thiếu role cần thiết', async () => {
    vi.clearAllMocks();
    mockGetActiveSession.mockResolvedValue(makeSession({ allowed_role_id: 'role-required' }));
    mockUpsertAttendance.mockResolvedValue(null);
    mockGetAttendances.mockResolvedValue([]);
    const guild = {
      id: 'g1',
      channels: { cache: new Map() },
      roles: { cache: new Map([['role-required', { name: 'Member' }]]) },
    };
    const member = { nickname: null, displayName: 'Alice', roles: { cache: new Map() } };
    await handler.run(makeInteraction('attendance:select', ['tham_gia'], { guild, member }));
    expect(mockUpsertAttendance).not.toHaveBeenCalled();
  });
});
