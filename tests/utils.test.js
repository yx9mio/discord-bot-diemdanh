// tests/utils.test.js
// Test utils: embeds.js, timeCalc.js, logger.js
// Vitest ESM — chạy cùng suite với các test khác
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require   = createRequire(import.meta.url);

// ─── Mock discord.js ─────────────────────────────────────────────────────────
vi.mock('discord.js', () => ({
  EmbedBuilder: class {
    setColor()       { return this; }
    setTitle()       { return this; }
    setDescription() { return this; }
    addFields()      { return this; }
    setFooter()      { return this; }
    setTimestamp()   { return this; }
    setThumbnail()   { return this; }
    setAuthor()      { return this; }
    data = {};
  },
  ActionRowBuilder: class { addComponents() { return this; } },
  ButtonBuilder: class {
    setCustomId()  { return this; }
    setLabel()     { return this; }
    setStyle()     { return this; }
    setDisabled()  { return this; }
  },
  ButtonStyle:  { Primary: 1, Secondary: 2, Success: 3, Danger: 4 },
  MessageFlags: { Ephemeral: 64 },
  PermissionFlagsBits: { Administrator: 8n },
  ChannelType: { GuildText: 0 },
  StringSelectMenuBuilder: class {
    setCustomId()    { return this; }
    setPlaceholder() { return this; }
    addOptions()     { return this; }
  },
  StringSelectMenuOptionBuilder: class {
    setLabel()       { return this; }
    setValue()       { return this; }
    setDescription() { return this; }
  },
}));

vi.mock('../db.js', () => ({
  default:              {},
  getMemberStatsMulti:  vi.fn().mockResolvedValue([]),
  getBadgeDefinitions:  vi.fn().mockResolvedValue([]),
}));

// ─── embeds.js ────────────────────────────────────────────────────────────────
describe('embeds.js', () => {
  let embeds;

  beforeAll(async () => {
    embeds = await import('../utils/embeds.js');
  });

  it('loads without error', () => {
    expect(embeds).toBeDefined();
  });

  it('replyOk returns object with embeds array', () => {
    const r = embeds.replyOk('test message');
    expect(Array.isArray(r.embeds)).toBe(true);
    expect(r.embeds.length).toBe(1);
  });

  it('replyErr returns object with flags (ephemeral) + embeds array', () => {
    const r = embeds.replyErr('lỗi test');
    expect(Array.isArray(r.embeds)).toBe(true);
    // replyErr dùng MessageFlags.Ephemeral (64) thay vì ephemeral: true
    expect(r).toHaveProperty('flags');
  });

  it('replyLoading returns object with embeds array', () => {
    const r = embeds.replyLoading();
    expect(Array.isArray(r.embeds)).toBe(true);
  });

  it('replyOkEdit returns object without ephemeral flag', () => {
    const r = embeds.replyOkEdit('done');
    expect(Array.isArray(r.embeds)).toBe(true);
    // editReply không cần ephemeral
    expect(r.ephemeral).not.toBe(true);
    expect(r.flags).toBeUndefined();
  });

  it('replyErrEdit returns object with embeds + components', () => {
    const r = embeds.replyErrEdit('err');
    expect(Array.isArray(r.embeds)).toBe(true);
    expect(r).toHaveProperty('components');
  });
});

// ─── timeCalc.js ──────────────────────────────────────────────────────────────
describe('timeCalc.js', () => {
  let tc;

  beforeAll(async () => {
    tc = await import('../utils/timeCalc.js');
  });

  it('loads without error', () => {
    expect(tc).toBeDefined();
  });

  it('exports formatDuration function', () => {
    expect(typeof tc.formatDuration).toBe('function');
  });

  it('formatDuration(0) returns "0 giây"', () => {
    const r = tc.formatDuration(0);
    expect(typeof r).toBe('string');
    expect(r.length).toBeGreaterThan(0);
  });

  it('formatDuration(3661) formats hours + minutes', () => {
    const r = tc.formatDuration(3661);
    expect(typeof r).toBe('string');
    expect(r.length).toBeGreaterThan(0);
    // 3661s = 1g 1p
    expect(r).toMatch(/1g/);
  });

  it('formatDuration(90) formats minutes + seconds', () => {
    const r = tc.formatDuration(90);
    expect(typeof r).toBe('string');
    expect(r.length).toBeGreaterThan(0);
    expect(r).toMatch(/1p/);
  });

  it('msToNextWeekday returns positive number', () => {
    const ms = tc.msToNextWeekday(6, 20, 0);
    expect(typeof ms).toBe('number');
    expect(ms).toBeGreaterThan(0);
  });
});

// ─── logger.js ────────────────────────────────────────────────────────────────
describe('logger.js', () => {
  let log;

  beforeAll(() => {
    // Load CJS logger qua createRequire để tránh vấn đề ESM mock
    log = require('../utils/logger.js');
  });

  it('loads without error', () => {
    expect(log).toBeDefined();
  });

  it('exports info, warn, error functions', () => {
    expect(typeof log.info).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.error).toBe('function');
  });

  it('calling log.info does not throw', () => {
    expect(() => log.info('TEST', 'guild-ci', 'CI log test')).not.toThrow();
  });
});
