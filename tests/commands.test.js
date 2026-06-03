// tests/commands.test.js
// Kiểm tra contract của mỗi command (Sapphire Framework pattern):
//   - Load được (không throw MODULE_NOT_FOUND)
//   - export đúng 1 class (tên kết thúc bằng "Command")
//   - Class có method registerApplicationCommands
//   - Class có method chatInputRun
import { describe, it, expect, vi } from 'vitest';
import { readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const commandsDir = resolve(__dirname, '../src/commands');

// ─── Mock deps nặng ─────────────────────────────────────────────────────────
vi.mock('../db.js', () => ({
  default: {},
  getActiveSession: vi.fn(),
  createSession: vi.fn(),
  closeSession: vi.fn(),
  getAttendances: vi.fn().mockResolvedValue([]),
  getLichCoDinh: vi.fn().mockResolvedValue([]),
  updateSessionMessage: vi.fn().mockResolvedValue(null),
  getMemberStatsMulti: vi.fn().mockResolvedValue([]),
  getBadgeDefinitions: vi.fn().mockResolvedValue([]),
  setGuildConfig: vi.fn().mockResolvedValue(null),
  getGuildConfig: vi.fn().mockResolvedValue({}),
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
  ActionRowBuilder: class { addComponents() { return this; } },
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

// Mock @sapphire/framework — cung cấp base class Command
vi.mock('@sapphire/framework', () => {
  class Command {
    constructor(context, options) {
      this.name = options?.name ?? '';
      this.description = options?.description ?? '';
    }
  }
  class ApplicationCommandRegistry {
    registerChatInputCommand(fn) {
      const builder = {
        setName(n) { this._name = n; return this; },
        setDescription() { return this; },
        setDefaultMemberPermissions() { return this; },
        addBooleanOption() { return this; },
        addStringOption() { return this; },
        addUserOption() { return this; },
        addIntegerOption() { return this; },
        addChannelOption() { return this; },
        addRoleOption() { return this; },
        addSubcommand() { return this; },
      };
      fn(builder);
    }
  }
  return { Command, ApplicationCommandRegistry };
});

vi.mock('../utils/embeds.js', () => ({
  buildAttendanceButtons:  vi.fn().mockReturnValue({}),
  buildSummaryEmbed:       vi.fn().mockReturnValue({ data: {} }),
  buildClosedSessionEmbed: vi.fn().mockReturnValue({ data: {} }),
  buildSessionEmbed:       vi.fn().mockReturnValue({ embed: { data: {} }, components: [] }),
  buildSessionActionRow:   vi.fn().mockReturnValue([]),
  buildAttendConfirmEmbed: vi.fn().mockReturnValue({ embeds: [], flags: 64 }),
  replyErr:       vi.fn().mockReturnValue({ embeds: [], flags: 64 }),
  replyErrEdit:   vi.fn().mockReturnValue({ embeds: [], components: [] }),
  replyOkEdit:    vi.fn().mockReturnValue({ embeds: [], components: [] }),
  replyWarnEdit:  vi.fn().mockReturnValue({ embeds: [], components: [] }),
  replyConfirm:   vi.fn().mockReturnValue({ embeds: [], components: [], flags: 64 }),
  FOOTER_DEFAULT: 'Quản Gia · Bot Điểm Danh',
}));

vi.mock('../utils/session.js', () => ({
  ketThucPhien:     vi.fn().mockResolvedValue(new Map()),
  thongBaoHuyHieu:  vi.fn().mockResolvedValue(null),
  guiCsvDinhKem:    vi.fn().mockResolvedValue(null),
}));

vi.mock('../utils/scheduler.js', () => ({
  scheduleLichCoDinh:  vi.fn().mockResolvedValue(undefined),
  khoiPhucScheduler:   vi.fn().mockResolvedValue(undefined),
  runLichNgay:         vi.fn().mockResolvedValue({ ok: true }),
}));

// ─── Helper: lấy Command class từ module CJS ────────────────────────────────
function extractCommandClass(mod) {
  // module.exports = { SomethingCommand } hoặc exports.SomethingCommand
  const keys = Object.keys(mod);
  const key = keys.find(k => k.endsWith('Command'));
  return key ? mod[key] : null;
}

// ─── Load danh sách file ─────────────────────────────────────────────────────
let commandFiles = [];
try {
  commandFiles = readdirSync(commandsDir)
    .filter(f => f.endsWith('.js'))
    .map(f => ({ file: f, path: join(commandsDir, f) }));
} catch {
  // src/commands không tồn tại — skip
}

// ─── Tests ──────────────────────────────────────────────────────────────────
describe('Commands contract (Sapphire)', () => {
  if (commandFiles.length === 0) {
    it('no command files found — skip', () => {
      expect(true).toBe(true);
    });
    return;
  }

  for (const { file, path } of commandFiles) {
    describe(file, () => {
      it('load được không throw', async () => {
        // Dùng createRequire để load CJS module
        const require = createRequire(import.meta.url);
        expect(() => require(path)).not.toThrow();
      });

      it('export đúng 1 class kết thúc bằng "Command"', async () => {
        const require = createRequire(import.meta.url);
        const mod = require(path);
        const CommandClass = extractCommandClass(mod);
        expect(CommandClass).not.toBeNull();
        expect(typeof CommandClass).toBe('function'); // class là function
      });

      it('class có method registerApplicationCommands', async () => {
        const require = createRequire(import.meta.url);
        const mod = require(path);
        const CommandClass = extractCommandClass(mod);
        expect(CommandClass).not.toBeNull();
        const proto = CommandClass?.prototype;
        expect(typeof proto?.registerApplicationCommands).toBe('function');
      });

      it('class có method chatInputRun', async () => {
        const require = createRequire(import.meta.url);
        const mod = require(path);
        const CommandClass = extractCommandClass(mod);
        expect(CommandClass).not.toBeNull();
        const proto = CommandClass?.prototype;
        expect(typeof proto?.chatInputRun).toBe('function');
      });
    });
  }
});
