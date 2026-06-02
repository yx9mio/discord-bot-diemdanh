// tests/smoke/attendanceButton.test.js
// Smoke test: BUG-1 regression — upsertAttendance đúng object payload
// BUG-6 regression — lock ngăn double-click
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db
const mockDb = {
  getActiveSession: vi.fn(),
  upsertAttendance: vi.fn(),
  getAttendances: vi.fn().mockResolvedValue([]),
};
vi.mock('../../db.js', () => mockDb);
vi.mock('../../utils/embeds.js', () => ({
  buildSessionEmbed:       vi.fn().mockResolvedValue({}),
  buildAttendanceButtons:  vi.fn().mockReturnValue([]),
  buildSessionActionRow:   vi.fn().mockReturnValue([]),
  buildAttendConfirmEmbed: vi.fn().mockReturnValue({ embeds: [], flags: 64 }),
}));

const SESSION = {
  id: 'sess1', guild_id: 'g1', channel_id: 'ch1',
  message_id: 'msg1', eligible_member_ids: null, allowed_role_id: null,
};

function makeInteraction(customId = 'attendance:join') {
  return {
    customId,
    guild: {
      id: 'g1',
      channels: { cache: new Map() },
      roles: { cache: new Map() },
    },
    member: {
      nickname: 'TestUser',
      roles: { cache: new Map() },
    },
    user: { id: 'u1', displayName: 'TestUser', username: 'testuser' },
    reply:      vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply:  vi.fn().mockResolvedValue(undefined),
  };
}

describe('AttendanceButton — BUG-1 regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.getActiveSession.mockResolvedValue(SESSION);
  });

  it('upsertAttendance được gọi với object payload (không phải positional args)', async () => {
    // Chạy handler trực tiếp (không qua Sapphire)
    const { AttendanceButtonHandler } = await import('../../interaction-handlers/attendanceButton.js');
    // Tạo instance giả lập
    const handler = { run: AttendanceButtonHandler.prototype.run };
    const interaction = makeInteraction('attendance:join');

    await handler.run.call(handler, interaction);

    expect(mockDb.upsertAttendance).toHaveBeenCalledOnce();
    const [arg] = mockDb.upsertAttendance.mock.calls[0];
    // BUG-1: phải là object, không phải string/number primitives
    expect(typeof arg).toBe('object');
    expect(arg).toHaveProperty('session_id', 'sess1');
    expect(arg).toHaveProperty('guild_id', 'g1');
    expect(arg).toHaveProperty('user_id', 'u1');
    expect(arg).toHaveProperty('status', 'tham_gia');
    expect(arg).toHaveProperty('marked_by', 'u1');
    expect(arg).toHaveProperty('checked_in_at');
  });

  it('không có phiên → reply ephemeral, không gọi upsertAttendance', async () => {
    mockDb.getActiveSession.mockResolvedValue(null);
    const { AttendanceButtonHandler } = await import('../../interaction-handlers/attendanceButton.js');
    const handler = { run: AttendanceButtonHandler.prototype.run };
    const interaction = makeInteraction('attendance:join');

    await handler.run.call(handler, interaction);
    expect(mockDb.upsertAttendance).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalled();
  });
});

describe('AttendanceButton — BUG-6 lock regression', () => {
  it('gọi 2 lần cùng lúc → lần 2 bị block bởi lock', async () => {
    mockDb.getActiveSession.mockResolvedValue(SESSION);
    // Làm upsertAttendance chậm để simulate concurrent
    mockDb.upsertAttendance.mockImplementation(() =>
      new Promise(resolve => setTimeout(resolve, 50))
    );

    const { AttendanceButtonHandler } = await import('../../interaction-handlers/attendanceButton.js');
    const handler = { run: AttendanceButtonHandler.prototype.run };
    const i1 = makeInteraction('attendance:join');
    const i2 = makeInteraction('attendance:join');

    // Chạy song song
    await Promise.all([
      handler.run.call(handler, i1).catch(() => {}),
      handler.run.call(handler, i2).catch(() => {}),
    ]);

    // upsertAttendance chỉ được gọi 1 lần (lần 2 bị lock)
    expect(mockDb.upsertAttendance).toHaveBeenCalledTimes(1);
  });
});
