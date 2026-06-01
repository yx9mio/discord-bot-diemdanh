import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock deps trước khi import scheduler
vi.mock('../db.js', () => ({
  getActiveSession:      vi.fn(),
  createSession:         vi.fn(),
  closeSession:          vi.fn(),
  getAttendances:        vi.fn().mockResolvedValue([]),
  getLichCoDinh:         vi.fn().mockResolvedValue([]),
  updateSessionMessage:  vi.fn().mockResolvedValue(null),
}));
vi.mock('../utils/embeds.js', () => ({
  buildAttendanceButtons:    vi.fn().mockReturnValue({}),
  buildSummaryEmbed:         vi.fn().mockReturnValue({}),
  buildClosedSessionEmbed:   vi.fn().mockResolvedValue({}),
  buildSessionEmbed:         vi.fn().mockResolvedValue({}),
  FOOTER_DEFAULT:            'footer',
}));
vi.mock('../utils/session.js', () => ({
  ketThucPhien:     vi.fn().mockResolvedValue(new Map()),
  thongBaoHuyHieu:  vi.fn().mockResolvedValue(null),
  guiCsvDinhKem:    vi.fn().mockResolvedValue(null),
}));
vi.mock('discord.js', () => ({ EmbedBuilder: class { setColor(){return this;} setTitle(){return this;} setDescription(){return this;} setFooter(){return this;} } }));

describe('scheduleLichCoDinh — zod validation', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

  it('bỏ qua lịch invalid thay vì throw', async () => {
    const { scheduleLichCoDinh } = await import('../utils/scheduler.js');
    const client = { guilds: { cache: new Map() } };
    const badLich = { id: 'not-a-uuid', day_of_week: 99 }; // invalid
    // Không throw là pass
    await expect(scheduleLichCoDinh(client, 'g1', badLich)).resolves.toBeUndefined();
  });
});

describe('khoiPhucScheduler', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

  it('chạy không lỗi khi getLichCoDinh trả về []', async () => {
    const db = await import('../db.js');
    db.getLichCoDinh.mockResolvedValue([]);
    const { khoiPhucScheduler } = await import('../utils/scheduler.js');
    const client = { guilds: { cache: new Map([['g1', { id: 'g1', name: 'Test' }]]) } };
    await expect(khoiPhucScheduler(client)).resolves.toBeUndefined();
  });
});
