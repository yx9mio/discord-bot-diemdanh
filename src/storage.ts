import fs from 'fs';
import path from 'path';
import { ConfigMap, GuildConfig, HistoryMap, HistorySession, MemberStats, MemberStatsMap, Session, SessionMap } from './types.js';

const DATA_DIR = path.resolve('./data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown): void {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Session Store ────────────────────────────────────────────────────────────
export const SessionStore = {
  all(): SessionMap { return readJson<SessionMap>('sessions.json', {}); },
  get(guildId: string): Session | null { return this.all()[guildId] ?? null; },
  set(guildId: string, session: Session): void {
    const data = this.all(); data[guildId] = session; writeJson('sessions.json', data);
  },
  delete(guildId: string): void {
    const data = this.all(); delete data[guildId]; writeJson('sessions.json', data);
  },
};

// ─── Config Store ─────────────────────────────────────────────────────────────
const DEFAULT_CONFIG: GuildConfig = {
  allowed_role_id: null, allowed_role_name: 'Bang Chúng',
  admin_role_id: null, admin_role_name: 'Bang Chủ',
};
export const ConfigStore = {
  all(): ConfigMap { return readJson<ConfigMap>('config.json', {}); },
  get(guildId: string): GuildConfig { return this.all()[guildId] ?? { ...DEFAULT_CONFIG }; },
  set(guildId: string, cfg: GuildConfig): void {
    const data = this.all(); data[guildId] = cfg; writeJson('config.json', data);
  },
};

// ─── History Store ────────────────────────────────────────────────────────────
export const HistoryStore = {
  all(): HistoryMap { return readJson<HistoryMap>('history.json', {}); },
  get(guildId: string): HistorySession[] { return this.all()[guildId] ?? []; },
  push(guildId: string, session: HistorySession): void {
    const data = this.all();
    if (!data[guildId]) data[guildId] = [];
    data[guildId].push(session);
    writeJson('history.json', data);
  },
};

// ─── Member Stats Store ───────────────────────────────────────────────────────
export const MemberStatsStore = {
  all(): MemberStatsMap { return readJson<MemberStatsMap>('members.json', {}); },
  get(guildId: string, userId: string): MemberStats | null {
    return this.all()[guildId]?.[userId] ?? null;
  },
  getAll(guildId: string): Record<string, MemberStats> {
    return this.all()[guildId] ?? {};
  },
  set(guildId: string, userId: string, stats: MemberStats): void {
    const data = this.all();
    if (!data[guildId]) data[guildId] = {};
    data[guildId][userId] = stats;
    writeJson('members.json', data);
  },
  setMany(guildId: string, map: Record<string, MemberStats>): void {
    const data = this.all();
    data[guildId] = { ...(data[guildId] ?? {}), ...map };
    writeJson('members.json', data);
  },
};
