// tests/unit/streak.test.js
// Thuật toán: Equivalence Partitioning + Boundary Value Analysis
// Test ketThucPhien streak/total logic hoàn toàn in-memory (không cần DB/Discord)
import { describe, it, expect } from 'vitest';

// ─── Inline implementation để test pure logic (tách khỏi DB) ─────────────────
const _PRESENT_STATUSES = new Set(['tham_gia', 'tre']);

function calcStreak(stats, status) {
  const isPresent = _PRESENT_STATUSES.has(status);
  if (!isPresent) return null;
  const streak = (stats.current_streak ?? 0) + 1;
  const total  = (stats.total_joined  ?? 0) + 1;
  const max    = Math.max(stats.best_streak ?? 0, streak);
  return { total, streak, max };
}

function shouldResetStreak(uid, presentIds, eligibleIds, statsCache) {
  if (!eligibleIds || eligibleIds.length === 0) return false;
  if (presentIds.has(uid)) return false;
  const stats = statsCache.get(uid);
  if (!stats || stats.current_streak === 0) return false;
  return true;
}

// ─── Tests: calcStreak ────────────────────────────────────────────────────────
describe('calcStreak', () => {
  it('status=tham_gia → tăng streak và total', () => {
    const r = calcStreak({ total_joined: 5, current_streak: 3, best_streak: 5 }, 'tham_gia');
    expect(r).toEqual({ total: 6, streak: 4, max: 5 });
  });

  it('status=tre → cũng được tính là có mặt', () => {
    const r = calcStreak({ total_joined: 0, current_streak: 0, best_streak: 0 }, 'tre');
    expect(r).toEqual({ total: 1, streak: 1, max: 1 });
  });

  it('status=khong_tham_gia → trả null', () => {
    const r = calcStreak({ total_joined: 5, current_streak: 3, best_streak: 5 }, 'khong_tham_gia');
    expect(r).toBeNull();
  });

  it('streak mới vượt best_streak → max tăng', () => {
    const r = calcStreak({ total_joined: 10, current_streak: 5, best_streak: 5 }, 'tham_gia');
    expect(r.max).toBe(6);
  });

  it('streak chưa vượt best_streak → max giữ nguyên', () => {
    const r = calcStreak({ total_joined: 10, current_streak: 3, best_streak: 10 }, 'tham_gia');
    expect(r.max).toBe(10);
  });

  it('stats từ 0 (người mới) → total=1, streak=1, max=1', () => {
    const r = calcStreak({ total_joined: 0, current_streak: 0, best_streak: 0 }, 'tham_gia');
    expect(r).toEqual({ total: 1, streak: 1, max: 1 });
  });

  // Boundary: giá trị nullish
  it('stats nullish fields → không NaN', () => {
    const r = calcStreak({}, 'tham_gia');
    expect(r).toEqual({ total: 1, streak: 1, max: 1 });
  });
});

// ─── Tests: shouldResetStreak ─────────────────────────────────────────────────
describe('shouldResetStreak', () => {
  const cache = new Map([
    ['u_has_streak',  { current_streak: 3 }],
    ['u_no_streak',   { current_streak: 0 }],
  ]);

  it('eligibleIds = null → không reset', () => {
    expect(shouldResetStreak('u_has_streak', new Set(), null, cache)).toBe(false);
  });

  it('eligibleIds = [] → không reset', () => {
    expect(shouldResetStreak('u_has_streak', new Set(), [], cache)).toBe(false);
  });

  it('user có mặt → không reset dù eligible', () => {
    const present = new Set(['u_has_streak']);
    expect(shouldResetStreak('u_has_streak', present, ['u_has_streak'], cache)).toBe(false);
  });

  it('user vắng + streak > 0 + trong eligible → reset', () => {
    expect(shouldResetStreak('u_has_streak', new Set(), ['u_has_streak'], cache)).toBe(true);
  });

  it('user vắng + streak = 0 → không reset', () => {
    expect(shouldResetStreak('u_no_streak', new Set(), ['u_no_streak'], cache)).toBe(false);
  });

  it('user không có trong statsCache → không reset', () => {
    expect(shouldResetStreak('ghost_user', new Set(), ['ghost_user'], cache)).toBe(false);
  });
});
