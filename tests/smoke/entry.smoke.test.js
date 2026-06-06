// tests/smoke/entry.smoke.test.js
// [Phase-E] Smoke test: kiểm tra các module chính có thể load mà không crash
import { describe, it, expect, vi } from 'vitest';

// ─── Smoke: utils/_helpers.js ────────────────────────────────────────────────────────
it('utils/_helpers load OK', async () => {
  const mod = await import('../../utils/_helpers.js');
  expect(mod.COLORS).toBeDefined();
  expect(mod.ICONS).toBeDefined();
  expect(mod.replyErr).toBeTypeOf('function');
});

// ─── Smoke: utils/_views/rows.js ─────────────────────────────────────────────────────
it('utils/_views/rows load OK', async () => {
  const mod = await import('../../utils/_views/rows.js');
  expect(mod.buildConfirmRow).toBeTypeOf('function');
  expect(mod.buildAttendanceRow).toBeTypeOf('function');
});

// ─── Smoke: utils/_views/summaryView.js ─────────────────────────────────────────────
it('utils/_views/summaryView load OK', async () => {
  const mod = await import('../../utils/_views/summaryView.js');
  expect(mod.buildSummaryEmbed).toBeTypeOf('function');
});

// ─── Smoke: utils/_views/sessionView.js ─────────────────────────────────────────────
it('utils/_views/sessionView load OK', async () => {
  const mod = await import('../../utils/_views/sessionView.js');
  expect(mod).toBeDefined();
});

// ─── Smoke: utils/_views/attendView.js ──────────────────────────────────────────────
it('utils/_views/attendView load OK', async () => {
  const mod = await import('../../utils/_views/attendView.js');
  expect(mod).toBeDefined();
});

describe('Environment stubs', () => {
  it('NODE_ENV = test', () => expect(process.env.NODE_ENV).toBe('test'));
  it('DISCORD_TOKEN được set', () => expect(process.env.DISCORD_TOKEN).toBeTruthy());
  it('SUPABASE_URL được set', () => expect(process.env.SUPABASE_URL).toBeTruthy());
});
