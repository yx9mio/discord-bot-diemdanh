import { describe, it, expect, vi } from 'vitest';

// ─── Mock discord.js + db.js ───────────────────────────────────────────────────────────
vi.mock('discord.js', () => ({
  EmbedBuilder: class {
    setColor() { return this; }
    setTitle(t) { this._title = t; return this; }
    setDescription(d) { this._desc = d; return this; }
    addFields(f) { this._fields = f; return this; }
    setFooter() { return this; }
    setTimestamp() { return this; }
    setThumbnail() { return this; }
    setAuthor() { return this; }
    data = {};
  },
  ActionRowBuilder: class {
    addComponents() { return this; }
    toJSON() { return {}; }
  },
  ButtonBuilder: class {
    setCustomId() { return this; }
    setLabel() { return this; }
    setStyle() { return this; }
    setDisabled() { return this; }
  },
  ButtonStyle: { Primary: 1, Secondary: 2, Success: 3, Danger: 4 },
  MessageFlags: { Ephemeral: 64 },
  StringSelectMenuBuilder: class {
    setCustomId() { return this; }
    setPlaceholder() { return this; }
    addOptions() { return this; }
  },
}));

vi.mock('../db.js', () => ({
  getMemberStatsMulti:  vi.fn().mockResolvedValue([]),
  getBadgeDefinitions:  vi.fn().mockResolvedValue([]),
}));

// ─── Fixtures ───────────────────────────────────────────────────────────────────────
const makeSession = (overrides = {}) => ({
  id: 'sess-1', session_name: 'Test', guild_id: 'g1',
  eligible_member_ids: null, created_at: new Date().toISOString(),
  is_active: true, cancelled: false, started_by: 'admin',
  ...overrides,
});

const makeAttended = () => [
  { user_id: 'u1', status: 'tham_gia',       username: 'Alice' },
  { user_id: 'u2', status: 'khong_tham_gia', username: 'Bob'   },
  { user_id: 'u3', status: 'tre',            username: 'Carol' },
  { user_id: 'u4', status: 'co_phep',        username: null    },
];

// guild mock có đủ method mà embeds.js có thể gọi
const makeGuild = (overrides = {}) => ({
  id: 'g1',
  name: 'Test Guild',
  memberCount: 50,
  iconURL: vi.fn().mockReturnValue(null),
  members: { cache: new Map() },
  roles: { cache: new Map() },
  ...overrides,
});

// ─── buildSummaryEmbed ────────────────────────────────────────────────────────────
describe('buildSummaryEmbed', () => {
  it('eligible_member_ids=null không crash', async () => {
    const { buildSummaryEmbed } = await import('../utils/embeds.js');
    expect(() => buildSummaryEmbed(makeSession({ eligible_member_ids: null }), makeAttended(), makeGuild()))
      .not.toThrow();
  });
  it('eligible_member_ids=[] không crash', async () => {
    const { buildSummaryEmbed } = await import('../utils/embeds.js');
    expect(() => buildSummaryEmbed(makeSession({ eligible_member_ids: [] }), makeAttended(), makeGuild()))
      .not.toThrow();
  });
  it('eligible_member_ids=[...] không crash', async () => {
    const { buildSummaryEmbed } = await import('../utils/embeds.js');
    expect(() => buildSummaryEmbed(makeSession({ eligible_member_ids: ['u1','u2'] }), makeAttended(), makeGuild()))
      .not.toThrow();
  });
  it('attended=[] không crash', async () => {
    const { buildSummaryEmbed } = await import('../utils/embeds.js');
    expect(() => buildSummaryEmbed(makeSession(), [], makeGuild())).not.toThrow();
  });
  it('guild=null không crash', async () => {
    const { buildSummaryEmbed } = await import('../utils/embeds.js');
    expect(() => buildSummaryEmbed(makeSession(), makeAttended(), null)).not.toThrow();
  });
  it('guild={} không crash', async () => {
    const { buildSummaryEmbed } = await import('../utils/embeds.js');
    expect(() => buildSummaryEmbed(makeSession(), makeAttended(), {})).not.toThrow();
  });
  it('guild đầy đủ method không crash', async () => {
    const { buildSummaryEmbed } = await import('../utils/embeds.js');
    expect(() => buildSummaryEmbed(makeSession(), makeAttended(), makeGuild())).not.toThrow();
  });
});

// ─── buildAttendanceButtons ──────────────────────────────────────────────────────────
describe('buildAttendanceButtons', () => {
  it('trả về ActionRow khi disabled=false', async () => {
    const { buildAttendanceButtons } = await import('../utils/embeds.js');
    const row = buildAttendanceButtons(false);
    expect(row).toBeDefined();
  });
  it('trả về ActionRow khi disabled=true', async () => {
    const { buildAttendanceButtons } = await import('../utils/embeds.js');
    const row = buildAttendanceButtons(true);
    expect(row).toBeDefined();
  });
});

// ─── replyErr helpers ─────────────────────────────────────────────────────────────────
describe('replyErr + replyErrEdit', () => {
  it('replyErr trả về object có flags', async () => {
    const { replyErr } = await import('../utils/embeds.js');
    const r = replyErr('test error');
    expect(r).toHaveProperty('flags');
    expect(r).toHaveProperty('embeds');
  });
  it('replyErrEdit trả về object có embeds + components', async () => {
    const { replyErrEdit } = await import('../utils/embeds.js');
    const r = replyErrEdit('test error');
    expect(r).toHaveProperty('embeds');
    expect(r).toHaveProperty('components');
  });
  it('replyOkEdit trả về object có embeds + components', async () => {
    const { replyOkEdit } = await import('../utils/embeds.js');
    const r = replyOkEdit('thành công');
    expect(r).toHaveProperty('embeds');
    expect(r).toHaveProperty('components');
  });
  it('replyWarnEdit trả về object có embeds + components', async () => {
    const { replyWarnEdit } = await import('../utils/embeds.js');
    const r = replyWarnEdit('cảnh báo');
    expect(r).toHaveProperty('embeds');
    expect(r).toHaveProperty('components');
  });
});
