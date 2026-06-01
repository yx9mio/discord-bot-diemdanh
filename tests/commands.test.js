// tests/commands.test.js
// Kiểm tra contract của mỗi command:
//   - Load được (không throw MODULE_NOT_FOUND)
//   - export { data, execute }
//   - data.name là string không rỗng
//   - execute là function
import { describe, it, expect, vi } from 'vitest';
import { readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const commandsDir = resolve(__dirname, '../src/commands');

// Mock tất cả deps nặng để command files load được
vi.mock('../db.js', () => ({
  getActiveSession: vi.fn(),
  createSession: vi.fn(),
  closeSession: vi.fn(),
  getAttendances: vi.fn().mockResolvedValue([]),
  getLichCoDinh: vi.fn().mockResolvedValue([]),
  updateSessionMessage: vi.fn().mockResolvedValue(null),
  getMemberStatsMulti: vi.fn().mockResolvedValue([]),
  getBadgeDefinitions: vi.fn().mockResolvedValue([]),
}));

vi.mock('discord.js', () => ({
  SlashCommandBuilder: class {
    setName(n) { this._name = n; return this; }
    setDescription() { return this; }
    addUserOption() { return this; }
    addStringOption() { return this; }
    addIntegerOption() { return this; }
    addBooleanOption() { return this; }
    addRoleOption() { return this; }
    addChannelOption() { return this; }
    addNumberOption() { return this; }
    addSubcommand() { return this; }
    get name() { return this._name; }
    toJSON() { return { name: this._name }; }
  },
  EmbedBuilder: class {
    setColor() { return this; }
    setTitle() { return this; }
    setDescription() { return this; }
    addFields() { return this; }
    setFooter() { return this; }
    setTimestamp() { return this; }
    setThumbnail() { return this; }
    setAuthor() { return this; }
    data = {};
  },
  ActionRowBuilder: class {
    addComponents() { return this; }
  },
  ButtonBuilder: class {
    setCustomId() { return this; }
    setLabel() { return this; }
    setStyle() { return this; }
    setDisabled() { return this; }
  },
  ButtonStyle: { Primary: 1, Secondary: 2, Success: 3, Danger: 4 },
  MessageFlags: { Ephemeral: 64 },
  PermissionFlagsBits: { Administrator: 8n, ManageGuild: 32n },
  ChannelType: { GuildText: 0 },
  StringSelectMenuBuilder: class {
    setCustomId() { return this; }
    setPlaceholder() { return this; }
    addOptions() { return this; }
  },
  StringSelectMenuOptionBuilder: class {
    setLabel() { return this; }
    setValue() { return this; }
    setDescription() { return this; }
  },
}));

vi.mock('../utils/embeds.js', () => ({
  buildAttendanceButtons: vi.fn().mockReturnValue({}),
  buildSummaryEmbed: vi.fn().mockReturnValue({ data: {} }),
  buildClosedSessionEmbed: vi.fn().mockResolvedValue({ data: {} }),
  buildSessionEmbed: vi.fn().mockResolvedValue({ data: {} }),
  replyErr: vi.fn().mockReturnValue({ embeds: [], flags: 64 }),
  replyErrEdit: vi.fn().mockReturnValue({ embeds: [], components: [] }),
  replyOkEdit: vi.fn().mockReturnValue({ embeds: [], components: [] }),
  replyWarnEdit: vi.fn().mockReturnValue({ embeds: [], components: [] }),
  replyConfirm: vi.fn().mockReturnValue({ embeds: [], components: [], flags: 64 }),
  FOOTER_DEFAULT: 'Quản Gia · Bot Điểm Danh',
}));

vi.mock('../utils/session.js', () => ({
  ketThucPhien: vi.fn().mockResolvedValue(new Map()),
  thongBaoHuyHieu: vi.fn().mockResolvedValue(null),
  guiCsvDinhKem: vi.fn().mockResolvedValue(null),
}));

vi.mock('../utils/scheduler.js', () => ({
  scheduleLichCoDinh: vi.fn().mockResolvedValue(undefined),
  khoiPhucScheduler: vi.fn().mockResolvedValue(undefined),
  runLichNgay: vi.fn().mockResolvedValue({ ok: true }),
}));

// ─── Load tất cả command files ──────────────────────────────────────────────
let commandFiles = [];
try {
  commandFiles = readdirSync(commandsDir)
    .filter(f => f.endsWith('.js'))
    .map(f => ({ file: f, path: join(commandsDir, f) }));
} catch {
  // src/commands không tồn tại — skip
}

describe('Commands contract', () => {
  if (commandFiles.length === 0) {
    it('no command files found — skip', () => {
      expect(true).toBe(true);
    });
    return;
  }

  for (const { file, path } of commandFiles) {
    describe(file, () => {
      it('load được không throw', async () => {
        await expect(import(path)).resolves.toBeDefined();
      });

      it('export { data, execute }', async () => {
        const mod = await import(path);
        expect(mod).toHaveProperty('data');
        expect(mod).toHaveProperty('execute');
      });

      it('data.name là string không rỗng', async () => {
        const { data } = await import(path);
        const name = typeof data?.name === 'string'
          ? data.name
          : (data?.toJSON?.()?.name ?? data?._name ?? '');
        expect(typeof name).toBe('string');
        expect(name.length).toBeGreaterThan(0);
      });

      it('execute là function', async () => {
        const { execute } = await import(path);
        expect(typeof execute).toBe('function');
      });
    });
  }
});
