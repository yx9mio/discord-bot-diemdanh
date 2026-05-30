import fs from 'fs';
import path from 'path';
import { Session, SessionMap } from './types.js';

const STORAGE_PATH = path.join(process.cwd(), 'data', 'sessions.json');

function ensureStorage(): void {
  const dir = path.dirname(STORAGE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(STORAGE_PATH)) save({});
}

function load(): SessionMap {
  ensureStorage();
  try {
    return JSON.parse(fs.readFileSync(STORAGE_PATH, 'utf-8')) as SessionMap;
  } catch {
    return {};
  }
}

function save(data: SessionMap): void {
  const dir = path.dirname(STORAGE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORAGE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export const SessionStore = {
  get(guildId: string): Session | null {
    const data = load();
    return data[guildId] ?? null;
  },

  set(guildId: string, session: Session): void {
    const data = load();
    data[guildId] = session;
    save(data);
  },

  delete(guildId: string): void {
    const data = load();
    delete data[guildId];
    save(data);
  },

  all(): SessionMap {
    return load();
  },
};
