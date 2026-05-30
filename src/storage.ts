import fs from 'fs';
import path from 'path';
import { GuildStatsMember, HistorySession, Session, StorageShape } from './types.js';

const STORAGE_PATH = path.join(process.cwd(), 'data', 'sessions.json');

function ensureStorage(): void {
  const dir = path.dirname(STORAGE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(STORAGE_PATH)) save({ sessions: {}, history: {} });
}

function load(): StorageShape {
  ensureStorage();
  try {
    const parsed = JSON.parse(fs.readFileSync(STORAGE_PATH, 'utf-8')) as Partial<StorageShape>;
    return {
      sessions: parsed.sessions ?? {},
      history: parsed.history ?? {},
    };
  } catch {
    return { sessions: {}, history: {} };
  }
}

function save(data: StorageShape): void {
  const dir = path.dirname(STORAGE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORAGE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export const Store = {
  getSession(guildId: string): Session | null {
    return load().sessions[guildId] ?? null;
  },

  setSession(guildId: string, session: Session): void {
    const data = load();
    data.sessions[guildId] = session;
    save(data);
  },

  deleteSession(guildId: string): void {
    const data = load();
    delete data.sessions[guildId];
    save(data);
  },

  appendHistory(guildId: string, historySession: HistorySession): void {
    const data = load();
    if (!data.history[guildId]) data.history[guildId] = [];
    data.history[guildId].unshift(historySession);
    data.history[guildId] = data.history[guildId].slice(0, 50);
    save(data);
  },

  getHistory(guildId: string): HistorySession[] {
    return load().history[guildId] ?? [];
  },

  getStats(guildId: string): GuildStatsMember[] {
    const history = load().history[guildId] ?? [];
    const map = new Map<string, GuildStatsMember>();

    for (const session of history) {
      for (const attendee of Object.values(session.attendees)) {
        const current = map.get(attendee.userId) ?? {
          userId: attendee.userId,
          name: attendee.name,
          tham_gia_count: 0,
          khong_tham_gia_count: 0,
          total_count: 0,
        };

        if (attendee.status === 'tham_gia') current.tham_gia_count += 1;
        if (attendee.status === 'khong_tham_gia') current.khong_tham_gia_count += 1;
        current.total_count += 1;
        map.set(attendee.userId, current);
      }
    }

    return [...map.values()].sort((a, b) => {
      if (b.tham_gia_count !== a.tham_gia_count) return b.tham_gia_count - a.tham_gia_count;
      return b.total_count - a.total_count;
    });
  },
};
