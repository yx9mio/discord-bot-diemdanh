// tests/setup.js — Việt setup chung cho toàn bộ Vitest suite
// [Phase-E] Khởi tạo mock Discord.js + Supabase trước mọi test
'use strict';
import { vi } from 'vitest';

// ─── Mock discord.js (tránh gọi WebSocket thật) ─────────────────────────────
vi.mock('discord.js', async () => {
  const actual = await vi.importActual('discord.js');
  return {
    ...actual,
    Client: vi.fn().mockImplementation(() => ({
      login: vi.fn().mockResolvedValue('TOKEN'),
      on: vi.fn(),
      guilds: { cache: new Map() },
      user: { tag: 'TestBot#0000', id: '000000000000000001' },
    })),
  };
});

// ─── Mock @supabase/supabase-js ─────────────────────────────────────────────
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      order:  vi.fn().mockReturnThis(),
      limit:  vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    channel: vi.fn(() => ({ subscribe: vi.fn(), unsubscribe: vi.fn() })),
    removeAllChannels: vi.fn(),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }) },
  })),
}));

// ─── Mock dotenv (không cần .env trong CI) ───────────────────────────────────────
vi.mock('dotenv', () => ({ config: vi.fn() }));

// ─── Mock dd-trace (không gửi trace thật trong CI) ──────────────────────────
vi.mock('dd-trace', () => ({ init: vi.fn(), tracer: { startSpan: vi.fn() } }));

// ─── Environment stubs ───────────────────────────────────────────────────────────────
process.env.DISCORD_TOKEN       = 'test-token';
process.env.DISCORD_CLIENT_ID   = '000000000000000001';
process.env.SUPABASE_URL        = 'https://test.supabase.co';
process.env.SUPABASE_KEY        = 'test-key';
process.env.NODE_ENV            = 'test';
