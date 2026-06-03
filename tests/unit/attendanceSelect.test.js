// tests/unit/attendanceSelect.test.js
// [D3] Unit tests cho attendanceSelect (lock, eligible, session closed)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const mockGetActiveSession = vi.fn();
const mockMarkAttendance = vi.fn();

function mockModule(modulePath, exports) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved, filename: resolved, loaded: true,
    exports, children: [], paths: [],
  };
}

mockModule('../../db.js', {
  getActiveSession: (...a) => mockGetActiveSession(...a),
});

mockModule('../../utils/attendanceService.js', {
  markAttendance: (...a) => mockMarkAttendance(...a),
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
  InteractionHandlerTypes: { StringSelect: 'StringSelect' },
});

const { AttendanceSelectHandler } = require('../../interaction-handlers/attendanceSelect.js');

const makeInteraction = (values = ['tham_gia']) => ({
  customId: 'attendance:select',
  values,
  guild: { id: 'g1' },
  member: { roles: { cache: new Map() } },
  user: { id: 'u1' },
  reply: vi.fn().mockResolvedValue(null),
});

const makeSession = (extra = {}) => ({
  id: 'sess-1',
  session_name: 'Phiên',
  ...extra,
});

const handler = new AttendanceSelectHandler({}, {});

describe('run() — không có session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSession.mockResolvedValue(null);
  });

  it('reply ephemeral khi không có phiên', async () => {
    const interaction = makeInteraction();
    await handler.run(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true, content: expect.stringContaining('Không có phiên') }),
    );
    expect(mockMarkAttendance).not.toHaveBeenCalled();
  });
});

describe('run() — gọi markAttendance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSession.mockResolvedValue(makeSession());
    mockMarkAttendance.mockResolvedValue(null);
  });

  it('delegate sang attendanceService với đúng status', async () => {
    const interaction = makeInteraction(['tre']);
    await handler.run(interaction);
    expect(mockMarkAttendance).toHaveBeenCalledOnce();
    expect(mockMarkAttendance.mock.calls[0][0]).toMatchObject({
      status: 'tre',
      session: makeSession(),
    });
  });
});

describe('run() — lock collision (qua attendanceService)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSession.mockResolvedValue(makeSession());
    mockMarkAttendance.mockImplementation(async ({ interaction }) => {
      await interaction.deferReply({ ephemeral: true });
      return interaction.editReply({ content: '⏳ Đang xử lý yêu cầu của bạn, vui lòng chờ...' });
    });
  });

  it('markAttendance xử lý lock message', async () => {
    const interaction = {
      ...makeInteraction(),
      deferReply: vi.fn().mockResolvedValue(null),
      editReply:  vi.fn().mockResolvedValue(null),
    };
    await handler.run(interaction);
    expect(mockMarkAttendance).toHaveBeenCalled();
  });
});

// Giữ mock lock ở db layer cho smoke tương thích — test integration lock thật
describe('attendanceService lock (db mock)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('tryAcquireAttendanceLock false → không upsert', async () => {
    mockModule('../../db.js', {
      getActiveSession: vi.fn().mockResolvedValue(makeSession()),
      tryAcquireAttendanceLock: vi.fn().mockResolvedValue(false),
      releaseAttendanceLock: vi.fn().mockResolvedValue(true),
      upsertAttendance: vi.fn(),
      getMemberStats: vi.fn().mockResolvedValue({ current_streak: 0 }),
      getAttendances: vi.fn().mockResolvedValue([]),
    });
    mockModule('../../utils/embeds.js', {
      buildSessionEmbed: vi.fn().mockReturnValue({ embed: {} }),
      buildSessionActionRow: vi.fn().mockReturnValue([]),
      buildAttendConfirmEmbed: vi.fn().mockReturnValue({ embeds: [] }),
    });
    mockModule('../../utils/session.js', {
      thongBaoStreakMilestone: vi.fn(),
      STREAK_MILESTONES: [5, 10, 20, 50],
    });

    delete require.cache[require.resolve('../../utils/attendanceService.js')];
    const { markAttendance } = require('../../utils/attendanceService.js');

    const deferReply = vi.fn().mockResolvedValue(null);
    const editReply = vi.fn().mockResolvedValue(null);
    const reply = vi.fn().mockResolvedValue(null);
    const interaction = {
      deferReply, editReply, reply,
      guild: { id: 'g1', channels: { cache: new Map() }, roles: { cache: new Map() } },
      member: { nickname: null, displayName: 'A', roles: { cache: new Map() } },
      user: { id: 'u1', displayName: 'A', username: 'a' },
    };

    await markAttendance({
      guild: interaction.guild,
      member: interaction.member,
      user: interaction.user,
      status: 'tham_gia',
      interaction,
      session: makeSession(),
    });

    const db = require('../../db.js');
    expect(db.tryAcquireAttendanceLock).toHaveBeenCalled();
    expect(db.upsertAttendance).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Đang xử lý'), ephemeral: true }),
    );
  });
});
