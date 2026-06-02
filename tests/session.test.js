import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// ─── Mock deps ──────────────────────────────────────────────────────────────────
const mockGetAllMemberStats     = vi.fn().mockResolvedValue([]);
const mockBatchUpsertMemberStats = vi.fn().mockResolvedValue(null);
const mockGetMemberBadges        = vi.fn().mockResolvedValue([]);
const mockUpsertMemberBadge      = vi.fn().mockResolvedValue(null);
const mockGetBadges              = vi.fn().mockResolvedValue([]);

// Pre-populate require.cache cho db + embeds (CJS). Workaround vì vi.mock()
// không intercept require() trong module CJS khi test file là ESM.
// KHÔNG mock session.js — đây là file đang được test.
function mockModule(modulePath, exports) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved, filename: resolved, loaded: true,
    exports, children: [], paths: [],
  };
}

mockModule('../db.js', {
  getAllMemberStats:     (...a) => mockGetAllMemberStats(...a),
  batchUpsertMemberStats: (...a) => mockBatchUpsertMemberStats(...a),
  getMemberBadges:      (...a) => mockGetMemberBadges(...a),
  upsertMemberBadge:    (...a) => mockUpsertMemberBadge(...a),
  getBadges:            (...a) => mockGetBadges(...a),
});

mockModule('../utils/embeds.js', {
  FOOTER_DEFAULT: 'footer',
  buildSummaryEmbed:       vi.fn().mockReturnValue({}),
  buildAttendanceButtons:  vi.fn().mockReturnValue({}),
  buildClosedSessionEmbed: vi.fn().mockResolvedValue({}),
});

const { ketThucPhien, thongBaoHuyHieu, guiCsvDinhKem } = require('../utils/session.js');

// ─── ketThucPhien ─────────────────────────────────────────────────────────────────
describe('ketThucPhien', () => {
  beforeEach(() => vi.clearAllMocks());

  const guild   = { id: 'g1', name: 'Guild Test' };
  const session = { id: 'sess-1', session_name: 'Test' };

  it('trả về Map rỗng khi không ai điểm danh', async () => {
    const result = await ketThucPhien(guild, session, []);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(mockBatchUpsertMemberStats).not.toHaveBeenCalled();
  });

  it('tính đúng streak cho người có mặt', async () => {
    mockGetAllMemberStats.mockResolvedValueOnce([
      { user_id: 'u1', total_joined: 5, current_streak: 3, best_streak: 5 },
    ]);
    const attended = [{ user_id: 'u1', status: 'tham_gia' }];
    const result = await ketThucPhien(guild, session, attended);
    expect(result.get('u1')).toEqual({ total: 6, streak: 4, max: 5 });
    expect(mockBatchUpsertMemberStats).toHaveBeenCalledOnce();
    const [calledGuildId, patches] = mockBatchUpsertMemberStats.mock.calls[0];
    expect(calledGuildId).toBe('g1');
    expect(patches[0]).toMatchObject({ user_id: 'u1', current_streak: 4, best_streak: 5 });
  });

  it('streak mới vượt best_streak → cập nhật best_streak', async () => {
    mockGetAllMemberStats.mockResolvedValueOnce([
      { user_id: 'u2', total_joined: 10, current_streak: 5, best_streak: 5 },
    ]);
    const result = await ketThucPhien(guild, session, [{ user_id: 'u2', status: 'tham_gia' }]);
    expect(result.get('u2').max).toBe(6);
    const [, patches] = mockBatchUpsertMemberStats.mock.calls[0];
    expect(patches[0].best_streak).toBe(6);
  });

  it('status=tre cũng được cộng streak (PRESENT_STATUSES)', async () => {
    const result = await ketThucPhien(guild, session, [{ user_id: 'u3', status: 'tre' }]);
    expect(result.has('u3')).toBe(true);
    expect(result.get('u3').streak).toBe(1);
  });

  it('eligible_member_ids=null → không crash (reset streak 0 người)', async () => {
    const sessNull = { ...session, eligible_member_ids: null };
    await expect(ketThucPhien(guild, sessNull, [])).resolves.toBeInstanceOf(Map);
  });

  it('reset streak người vắng eligible', async () => {
    mockGetAllMemberStats.mockResolvedValueOnce([
      { user_id: 'absent1', total_joined: 8, current_streak: 3, best_streak: 5 },
    ]);
    const sessWithEligible = { ...session, eligible_member_ids: ['absent1'] };
    await ketThucPhien(guild, sessWithEligible, []);
    const [, patches] = mockBatchUpsertMemberStats.mock.calls[0];
    const resetPatch = patches.find(p => p.user_id === 'absent1');
    expect(resetPatch.current_streak).toBe(0);
  });

  it('người vắng có streak=0 không bị thêm vào patches (skip)', async () => {
    mockGetAllMemberStats.mockResolvedValueOnce([
      { user_id: 'nostreak', total_joined: 2, current_streak: 0, best_streak: 2 },
    ]);
    const sess = { ...session, eligible_member_ids: ['nostreak'] };
    await ketThucPhien(guild, sess, []);
    expect(mockBatchUpsertMemberStats).not.toHaveBeenCalled();
  });
});

// ─── guiCsvDinhKem ────────────────────────────────────────────────────────────────
describe('guiCsvDinhKem', () => {
  it('gọi channel.send với file đúng format', async () => {
    const send = vi.fn().mockResolvedValue(null);
    const channel = { send };
    const session = { id: 'sess-1', session_name: 'Hop', guild_id: 'g1' };
    const attended = [
      { user_id: 'u1', username: 'Alice', status: 'tham_gia', checked_in_at: '2026-06-01T10:00:00Z' },
      { user_id: 'u2', username: null,    status: 'khong_tham_gia', checked_in_at: null },
    ];
    await guiCsvDinhKem(channel, session, attended);
    expect(send).toHaveBeenCalledOnce();
    const arg = send.mock.calls[0][0];
    expect(arg.files).toHaveLength(1);
    const csv = arg.files[0].attachment.toString('utf-8');
    expect(csv).toContain('user_id,username,status,time');
    expect(csv).toContain('u1,Alice,tham_gia');
    expect(csv).toContain('u2,,khong_tham_gia');
  });

  it('không throw nếu channel.send lỗi', async () => {
    const channel = { send: vi.fn().mockRejectedValue(new Error('Discord error')) };
    await expect(
      guiCsvDinhKem(channel, { id: 's1', session_name: 'X', guild_id: 'g1' }, [])
    ).resolves.toBeUndefined();
  });

  it('tên file không có ký tự đặc biệt', async () => {
    const send = vi.fn().mockResolvedValue(null);
    await guiCsvDinhKem({ send }, { id: 's1', session_name: 'Hợp Lệ Năm 2026!', guild_id: 'g1' }, []);
    const filename = send.mock.calls[0][0].files[0].name;
    expect(filename).toMatch(/^diemdanh-[a-zA-Z0-9_-]+\.csv$/);
  });
});

// ─── thongBaoHuyHieu ────────────────────────────────────────────────────────────
describe('thongBaoHuyHieu', () => {
  beforeEach(() => vi.clearAllMocks());

  const guild   = { id: 'g1' };
  const channel = { send: vi.fn().mockResolvedValue(null) };

  it('không gửi nếu statsMap rỗng', async () => {
    await thongBaoHuyHieu(guild, channel, 'g1', 'sess-1', [], new Map());
    expect(channel.send).not.toHaveBeenCalled();
  });

  it('không gửi nếu user chưa đạt ngưỡng nào', async () => {
    const statsMap = new Map([['u1', { total: 3, streak: 3, max: 3 }]]);
    await thongBaoHuyHieu(guild, channel, 'g1', 'sess-1', [], statsMap);
    expect(channel.send).not.toHaveBeenCalled();
  });

  it('gửi embed khi user đạt ngưỡng mới', async () => {
    // stats.total = 5 → ngưỡng 5
    mockGetMemberBadges.mockResolvedValueOnce([]); // chưa có badge
    const statsMap = new Map([['u1', { total: 5, streak: 5, max: 5 }]]);
    await thongBaoHuyHieu(guild, channel, 'g1', 'sess-1', [], statsMap);
    expect(mockUpsertMemberBadge).toHaveBeenCalledWith('g1', 'u1', 5);
    expect(channel.send).toHaveBeenCalledOnce();
  });

  it('không gửi lại badge đã có', async () => {
    mockGetMemberBadges.mockResolvedValueOnce([{ threshold: 5 }]); // đã có
    const statsMap = new Map([['u1', { total: 5, streak: 5, max: 5 }]]);
    await thongBaoHuyHieu(guild, channel, 'g1', 'sess-1', [], statsMap);
    expect(mockUpsertMemberBadge).not.toHaveBeenCalled();
    expect(channel.send).not.toHaveBeenCalled();
  });
});
