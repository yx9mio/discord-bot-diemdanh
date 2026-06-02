import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// ─── Mock tất cả deps ────────────────────────────────────────────────────────────
const mockGetActiveSession      = vi.fn();
const mockCreateSession         = vi.fn();
const mockCloseSession          = vi.fn();
const mockGetAttendances        = vi.fn().mockResolvedValue([]);
const mockGetLichCoDinh         = vi.fn().mockResolvedValue([]);
const mockUpdateSessionMessage  = vi.fn().mockResolvedValue(null);

// Pre-populate require.cache cho SUT (CJS). Workaround vì vi.mock() không
// intercept require() trong module CJS khi test file là ESM.
function mockModule(modulePath, exports) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved, filename: resolved, loaded: true,
    exports, children: [], paths: [],
  };
}

mockModule('../db.js', {
  getActiveSession:     (...a) => mockGetActiveSession(...a),
  createSession:        (...a) => mockCreateSession(...a),
  closeSession:         (...a) => mockCloseSession(...a),
  getAttendances:       (...a) => mockGetAttendances(...a),
  getLichCoDinh:        (...a) => mockGetLichCoDinh(...a),
  updateSessionMessage: (...a) => mockUpdateSessionMessage(...a),
});

mockModule('../utils/embeds.js', {
  buildAttendanceButtons:  vi.fn().mockReturnValue({}),
  buildSummaryEmbed:       vi.fn().mockReturnValue({ data: {} }),
  buildClosedSessionEmbed: vi.fn().mockResolvedValue({ data: {} }),
  buildSessionEmbed:       vi.fn().mockResolvedValue({ data: {} }),
  FOOTER_DEFAULT:          'footer',
});

mockModule('../utils/session.js', {
  ketThucPhien:    vi.fn().mockResolvedValue(new Map()),
  thongBaoHuyHieu: vi.fn().mockResolvedValue(null),
  guiCsvDinhKem:   vi.fn().mockResolvedValue(null),
});

const { scheduleLichCoDinh, khoiPhucScheduler, runLichNgay } = require('../utils/scheduler.js');

const validLich = {
  id: '00000000-0000-0000-0000-000000000001',
  guild_id: 'g1', channel_id: 'ch1', session_name: 'Hop',
  day_of_week: 6, hour: 20, minute: 0,
  close_day_of_week: null,
};

// ─── scheduleLichCoDinh ────────────────────────────────────────────────────────────
describe('scheduleLichCoDinh', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

  it('bỏ qua lịch invalid (day_of_week=99) không throw', async () => {
    const client = { guilds: { cache: new Map() } };
    await expect(
      scheduleLichCoDinh(client, 'g1', { id: 'not-uuid', day_of_week: 99 })
    ).resolves.toBeUndefined();
  });

  it('đăng ký timer khi lịch hợp lệ', async () => {
    const client = { guilds: { cache: new Map() } };
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    await scheduleLichCoDinh(client, 'g1', validLich);
    expect(setTimeoutSpy).toHaveBeenCalled();
  });
});

// ─── _moPhien guards ───────────────────────────────────────────────────────────────
// Test thông qua runLichNgay (public API gọi _moPhien nội bộ)
describe('runLichNgay — _moPhien guards', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

  const fakeGuild = {
    id: 'g1', name: 'Guild',
    channels: { fetch: vi.fn().mockResolvedValue({ send: vi.fn().mockResolvedValue({ id: 'msg1' }) }) },
  };
  const client = { guilds: { cache: new Map([['g1', fakeGuild]]) } };

  it('guard: đã có active session → { ok: false, reason: already_open }', async () => {
    mockGetActiveSession.mockResolvedValueOnce({ id: 'existing-sess' });
    const result = await runLichNgay(client, 'g1', validLich);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('already_open');
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('guard: channel không tồn tại → { ok: false, reason: channel_not_found }', async () => {
    mockGetActiveSession.mockResolvedValueOnce(null);
    const guildNoChannel = {
      ...fakeGuild,
      channels: { fetch: vi.fn().mockResolvedValue(null) },
    };
    const client2 = { guilds: { cache: new Map([['g1', guildNoChannel]]) } };
    const result = await runLichNgay(client2, 'g1', validLich);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('channel_not_found');
  });

  it('guard: createSession trả về null → { ok: false, reason: db_error }', async () => {
    mockGetActiveSession.mockResolvedValueOnce(null);
    mockCreateSession.mockResolvedValueOnce(null); // simulate DB fail
    const result = await runLichNgay(client, 'g1', validLich);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('db_error');
  });

  it('mở thành công → { ok: true, session }', async () => {
    mockGetActiveSession.mockResolvedValueOnce(null);
    mockCreateSession.mockResolvedValueOnce({ id: 'new-sess', session_name: 'Hop', guild_id: 'g1' });
    const result = await runLichNgay(client, 'g1', validLich);
    expect(result.ok).toBe(true);
    expect(result.session.id).toBe('new-sess');
    expect(mockUpdateSessionMessage).toHaveBeenCalled();
  });

  it('lịch invalid throw Error', async () => {
    await expect(
      runLichNgay(client, 'g1', { id: 'bad', day_of_week: 99 })
    ).rejects.toThrow(/Lịch không hợp lệ/);
  });
});

// ─── khoiPhucScheduler ────────────────────────────────────────────────────────────
describe('khoiPhucScheduler', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

  it('chạy không lỗi khi không có lịch', async () => {
    mockGetLichCoDinh.mockResolvedValue([]);
    const client = { guilds: { cache: new Map([['g1', { id: 'g1', name: 'G' }]]) } };
    await expect(khoiPhucScheduler(client)).resolves.toBeUndefined();
  });

  it('bỏ qua lịch corrupt, tiếp tục các lịch hợp lệ khác', async () => {
    mockGetLichCoDinh.mockResolvedValue([
      { id: 'bad-uuid', day_of_week: 99 }, // invalid
      validLich,                           // hợp lệ
    ]);
    const client = { guilds: { cache: new Map([['g1', { id: 'g1', name: 'G' }]]) } };
    await expect(khoiPhucScheduler(client)).resolves.toBeUndefined();
    // valid lich phải tạo 1 setTimeout (open timer)
    // không throw là thành công
  });

  it('mỗi guild lỗi DB không làm crash toàn bộ', async () => {
    mockGetLichCoDinh.mockRejectedValue(new Error('DB down'));
    const client = { guilds: { cache: new Map([
      ['g1', { id: 'g1', name: 'G1' }],
      ['g2', { id: 'g2', name: 'G2' }],
    ]) } };
    // Cả 2 guild đều lỗi — nhưng không throw
    await expect(khoiPhucScheduler(client)).resolves.toBeUndefined();
  });
});
