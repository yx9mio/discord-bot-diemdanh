// tests/unit/session.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetAllMemberStats      = vi.fn();
const mockBatchUpsertMemberStats = vi.fn();
const mockGetMemberBadges        = vi.fn();
const mockUpsertMemberBadge      = vi.fn();
const mockGetBadges              = vi.fn();

vi.mock('../../db.js', () => ({
  getAllMemberStats:      (...a) => mockGetAllMemberStats(...a),
  batchUpsertMemberStats: (...a) => mockBatchUpsertMemberStats(...a),
  getMemberBadges:        (...a) => mockGetMemberBadges(...a),
  upsertMemberBadge:      (...a) => mockUpsertMemberBadge(...a),
  getBadges:              (...a) => mockGetBadges(...a),
}));

vi.mock('discord.js', () => ({
  EmbedBuilder: class {
    setTitle()       { return this; }
    setColor()       { return this; }
    setDescription() { return this; }
    setFooter()      { return this; }
    setTimestamp()   { return this; }
  },
}));

vi.mock('../../utils/embeds.js', () => ({
  FOOTER_DEFAULT:          'footer',
  buildSummaryEmbed:       vi.fn().mockReturnValue({}),
  buildAttendanceButtons:  vi.fn().mockReturnValue({}),
  buildClosedSessionEmbed: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  info: vi.fn(), warn: vi.fn(), error: vi.fn(),
}));

const { ketThucPhien, thongBaoHuyHieu, guiCsvDinhKem, getBadgeList } =
  await import('../../utils/session.js');

const GUILD   = { id: 'g1', name: 'Test Guild' };
const SESSION = { id: 'sess-1', session_name: 'Họp thường' };

// ─── ketThucPhien ────────────────────────────────────────────────────────────
describe('ketThucPhien', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllMemberStats.mockResolvedValue([]);
    mockBatchUpsertMemberStats.mockResolvedValue(null);
  });

  it('trả về Map rỗng khi attended = []', async () => {
    const result = await ketThucPhien(GUILD, SESSION, []);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(mockBatchUpsertMemberStats).not.toHaveBeenCalled();
  });

  it('tính đúng total + streak cho người tham gia mới', async () => {
    mockGetAllMemberStats.mockResolvedValueOnce([
      { user_id: 'u1', total_joined: 5, current_streak: 3, best_streak: 5 },
    ]);
    const attended = [{ user_id: 'u1', status: 'tham_gia' }];
    const result = await ketThucPhien(GUILD, SESSION, attended);
    expect(result.get('u1')).toEqual({ total: 6, streak: 4, max: 5 });
  });

  it('best_streak tăng khi streak mới vượt qua', async () => {
    mockGetAllMemberStats.mockResolvedValueOnce([
      { user_id: 'u2', total_joined: 10, current_streak: 5, best_streak: 5 },
    ]);
    const result = await ketThucPhien(GUILD, SESSION, [{ user_id: 'u2', status: 'tham_gia' }]);
    expect(result.get('u2').max).toBe(6);
    const [, patches] = mockBatchUpsertMemberStats.mock.calls[0];
    expect(patches[0].best_streak).toBe(6);
  });

  it('status=tre cũng được tính là có mặt', async () => {
    const result = await ketThucPhien(GUILD, SESSION, [{ user_id: 'u3', status: 'tre' }]);
    expect(result.has('u3')).toBe(true);
    expect(result.get('u3').streak).toBe(1);
  });

  it('status=khong_tham_gia KHÔNG vào statsMap', async () => {
    const result = await ketThucPhien(GUILD, SESSION, [{ user_id: 'u4', status: 'khong_tham_gia' }]);
    expect(result.has('u4')).toBe(false);
  });

  it('eligible_member_ids = null → không reset streak', async () => {
    mockGetAllMemberStats.mockResolvedValueOnce([
      { user_id: 'u5', total_joined: 8, current_streak: 3, best_streak: 5 },
    ]);
    const sess = { ...SESSION, eligible_member_ids: null };
    await ketThucPhien(GUILD, sess, []);
    expect(mockBatchUpsertMemberStats).not.toHaveBeenCalled();
  });

  it('eligible_member_ids = [] → không reset streak', async () => {
    mockGetAllMemberStats.mockResolvedValueOnce([
      { user_id: 'u6', total_joined: 8, current_streak: 3, best_streak: 5 },
    ]);
    const sess = { ...SESSION, eligible_member_ids: [] };
    await ketThucPhien(GUILD, sess, []);
    expect(mockBatchUpsertMemberStats).not.toHaveBeenCalled();
  });

  it('reset streak khi eligible có data và người vắng có streak > 0', async () => {
    mockGetAllMemberStats.mockResolvedValueOnce([
      { user_id: 'absent1', total_joined: 8, current_streak: 3, best_streak: 5 },
    ]);
    const sess = { ...SESSION, eligible_member_ids: ['absent1'] };
    await ketThucPhien(GUILD, sess, []);
    const [, patches] = mockBatchUpsertMemberStats.mock.calls[0];
    const patch = patches.find(p => p.user_id === 'absent1');
    expect(patch.current_streak).toBe(0);
    expect(patch.best_streak).toBe(5);
  });

  it('người vắng có streak=0 → KHÔNG thêm vào patches', async () => {
    mockGetAllMemberStats.mockResolvedValueOnce([
      { user_id: 'no_streak', total_joined: 2, current_streak: 0, best_streak: 2 },
    ]);
    const sess = { ...SESSION, eligible_member_ids: ['no_streak'] };
    await ketThucPhien(GUILD, sess, []);
    expect(mockBatchUpsertMemberStats).not.toHaveBeenCalled();
  });

  it('user không có stats trong DB → khởi tạo từ 0', async () => {
    mockGetAllMemberStats.mockResolvedValueOnce([]);
    const result = await ketThucPhien(GUILD, SESSION, [{ user_id: 'newbie', status: 'tham_gia' }]);
    expect(result.get('newbie')).toEqual({ total: 1, streak: 1, max: 1 });
  });

  it('batchUpsertMemberStats nhận đúng guild_id', async () => {
    await ketThucPhien(GUILD, SESSION, [{ user_id: 'u7', status: 'tham_gia' }]);
    expect(mockBatchUpsertMemberStats).toHaveBeenCalledWith('g1', expect.any(Array));
  });
});

// ─── guiCsvDinhKem ────────────────────────────────────────────────────────────
describe('guiCsvDinhKem', () => {
  it('gọi channel.send 1 lần với file CSV', async () => {
    const send = vi.fn().mockResolvedValue(null);
    const channel = { send };
    const sess = { id: 's1', session_name: 'Hop', guild_id: 'g1' };
    const attended = [
      { user_id: 'u1', username: 'Alice', status: 'tham_gia',       checked_in_at: '2026-06-01T10:00:00Z' },
      { user_id: 'u2', username: null,    status: 'khong_tham_gia',  checked_in_at: null },
    ];
    await guiCsvDinhKem(channel, sess, attended);
    expect(send).toHaveBeenCalledOnce();
    const arg = send.mock.calls[0][0];
    expect(arg.files).toHaveLength(1);
    const csv = arg.files[0].attachment.toString('utf-8');
    expect(csv).toContain('user_id,username,status,time');
    expect(csv).toContain('u1,Alice,tham_gia');
    expect(csv).toContain('u2,,khong_tham_gia');
  });

  it('tên file chỉ chứa ký tự an toàn', async () => {
    const send = vi.fn().mockResolvedValue(null);
    await guiCsvDinhKem({ send }, { id: 's1', session_name: 'Họp Lệ Năm 2026!', guild_id: 'g1' }, []);
    const filename = send.mock.calls[0][0].files[0].name;
    expect(filename).toMatch(/^diemdanh-[a-zA-Z0-9_-]+\.csv$/);
  });

  it('không throw khi channel.send ném lỗi', async () => {
    const channel = { send: vi.fn().mockRejectedValue(new Error('Discord error')) };
    await expect(
      guiCsvDinhKem(channel, { id: 's1', session_name: 'X', guild_id: 'g1' }, [])
    ).resolves.toBeUndefined();
  });

  it('CSV có đúng số dòng (header + attended.length)', async () => {
    const send = vi.fn().mockResolvedValue(null);
    const attended = Array.from({ length: 5 }, (_, i) => ({
      user_id: `u${i}`, username: `user${i}`, status: 'tham_gia', checked_in_at: null,
    }));
    await guiCsvDinhKem({ send }, { id: 's1', session_name: 'Test', guild_id: 'g1' }, attended);
    const csv = send.mock.calls[0][0].files[0].attachment.toString('utf-8');
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(6);
  });
});

// ─── thongBaoHuyHieu ──────────────────────────────────────────────────────────
describe('thongBaoHuyHieu', () => {
  const guild = { id: 'g1' };
  const sendMock = vi.fn().mockResolvedValue(null);
  const channel = { send: sendMock };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMemberBadges.mockResolvedValue([]);
    mockUpsertMemberBadge.mockResolvedValue(null);
    mockGetBadges.mockResolvedValue([]);
  });

  it('không gửi embed khi statsMap rỗng', async () => {
    await thongBaoHuyHieu(guild, channel, 'g1', 's1', [], new Map());
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('không gửi badge khi chưa đạt ngưỡng nào', async () => {
    const statsMap = new Map([['u1', { total: 2, streak: 1, max: 1 }]]);
    mockGetMemberBadges.mockResolvedValue([]);
    await thongBaoHuyHieu(guild, channel, 'g1', 's1', [], statsMap);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('gửi embed khi đạt ngưỡng badge đầu tiên', async () => {
    const statsMap = new Map([['u1', { total: 5, streak: 1, max: 1 }]]);
    mockGetMemberBadges.mockResolvedValue([]);
    await thongBaoHuyHieu(guild, channel, 'g1', 's1', [], statsMap);
    expect(sendMock).toHaveBeenCalledOnce();
    const arg = sendMock.mock.calls[0][0];
    expect(arg).toHaveProperty('embeds');
  });

  it('không gửi badge nếu đã có trong getMemberBadges', async () => {
    const statsMap = new Map([['u1', { total: 10, streak: 1, max: 1 }]]);
    mockGetMemberBadges.mockResolvedValue([{ threshold: 5 }, { threshold: 10 }]);
    await thongBaoHuyHieu(guild, channel, 'g1', 's1', [], statsMap);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('không throw khi upsertMemberBadge ném lỗi (best-effort)', async () => {
    const statsMap = new Map([['u1', { total: 5, streak: 1, max: 1 }]]);
    mockGetMemberBadges.mockResolvedValue([]);
    mockUpsertMemberBadge.mockRejectedValue(new Error('DB error'));
    await expect(
      thongBaoHuyHieu(guild, channel, 'g1', 's1', [], statsMap)
    ).resolves.toBeUndefined();
  });
});

// ─── getBadgeList ─────────────────────────────────────────────────────────────
describe('getBadgeList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('dùng DEFAULT_BADGES khi DB trả mảng rỗng', async () => {
    mockGetBadges.mockResolvedValue([]);
    const result = await getBadgeList('g1');
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('threshold');
    expect(result[0]).toHaveProperty('emoji');
  });

  it('dùng custom badges khi DB trả kết quả', async () => {
    const custom = [{ threshold: 1, emoji: '🌟', label: 'Custom' }];
    mockGetBadges.mockResolvedValue(custom);
    const result = await getBadgeList('g1');
    expect(result).toEqual(custom);
  });

  it('fallback DEFAULT_BADGES khi DB throw', async () => {
    mockGetBadges.mockRejectedValue(new Error('DB down'));
    const result = await getBadgeList('g1');
    expect(result.length).toBeGreaterThan(0);
  });
});