import fs from 'node:fs';
import path from 'node:path';
import { ConfigMap, GuildConfig, HistoryMap, HistorySession, Session, SessionMap } from './types.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const SESSIONS_PATH = path.join(DATA_DIR, 'sessions.json');
const HISTORY_PATH = path.join(DATA_DIR, 'history.json');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

function ensureFile(filePath: string, empty: object): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify(empty, null, 2), 'utf-8');
}

function readJson<T>(filePath: string, fallback: T): T {
  ensureFile(filePath, fallback as object);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(filePath: string, value: T): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

export const SessionStore = {
  all(): SessionMap {
    return readJson<SessionMap>(SESSIONS_PATH, {});
  },
  get(guildId: string): Session | null {
    const all = this.all();
    return all[guildId] ?? null;
  },
  set(guildId: string, session: Session): void {
    const all = this.all();
    all[guildId] = session;
    writeJson(SESSIONS_PATH, all);
  },
  delete(guildId: string): void {
    const all = this.all();
    delete all[guildId];
    writeJson(SESSIONS_PATH, all);
  },
};

export const ConfigStore = {
  all(): ConfigMap {
    return readJson<ConfigMap>(CONFIG_PATH, {});
  },
  get(guildId: string): GuildConfig {
    const all = this.all();
    return all[guildId] ?? { allowed_role_id: null, allowed_role_name: 'Bang Chúng' };
  },
  set(guildId: string, config: GuildConfig): void {
    const all = this.all();
    all[guildId] = config;
    writeJson(CONFIG_PATH, all);
  },
};

export const HistoryStore = {
  all(): HistoryMap {
    return readJson<HistoryMap>(HISTORY_PATH, {});
  },
  get(guildId: string): HistorySession[] {
    const all = this.all();
    return all[guildId] ?? [];
  },
  push(guildId: string, item: HistorySession): void {
    const all = this.all();
    const list = all[guildId] ?? [];
    list.unshift(item);
    all[guildId] = list.slice(0, 25);
    writeJson(HISTORY_PATH, all);
  },
};
