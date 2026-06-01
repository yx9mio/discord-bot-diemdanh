// tests/unit/streak.test.js
// Thuật toán: Equivalence Partitioning + Boundary Value Analysis
// Test ketThucPhien streak/total logic hoàn toàn in-memory (không cần DB/Discord)
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Inline implementation để test pure logic (tách khỏi DB) ───────────────
const PRESENT_STATUSES = new Set(['tham_gia', 'tre']);

function computePatches(session, attended, existingStats) {
  const statsMap = new Map();
  const patches  = [];
  const presentIds = new Set(
    attended.filter(r => PRESENT_STATUSES.has(r.status)).map(r => r.user_id)
  );
  const statsCache = new Map(existingStats.map(s => [s.user_id, s]));

  for (const record of attended) {
    if (!PRESENT_STATUSES.has(record.status)) continue;
    const uid    = record.user_id;
    const stats  = statsCache.get(uid) ?? { total_joined: 0, current_streak: 0, best_streak: 0 };
    const total  = (stats.total_joined   ?? 0) + 1;
    const streak = (stats.current_streak ?? 0) + 1;
    const maxS   = Math.max(stats.best_streak ?? 0, streak);
    statsMap.set(uid, { total, streak, max: maxS });
    patches.push({ user_id: uid, total_joined: total, current_streak: streak, best_streak: maxS });
  }

  const eligibleIds = session.eligible_member_ids ?? [];
  if (eligibleIds.length > 0) {
    for (const uid of eligibleIds.filter(id => !presentIds.has(id))) {
      const stats = statsCache.get(uid);
      if (!stats || stats.current_streak === 0) continue;
      patches.push({ user_id: uid, total_joined: stats.total_joined ?? 0, current_streak: 0, best_streak: stats.best_streak ?? 0 });
    }
  }
  return { statsMap, patches };
}
// ───────────────────────────────────────────────────────────────────────────

const SESSION_BASE = { id: 'sess1', session_name: 'Test', eligible_member_ids: [] };

describe('ketThucPhien — streak logic', () => {
  // EP: người có mặt (tham_gia)
  it('tham_gia → total +1, streak +1', () => {
    const { patches } = computePatches(
      SESSION_BASE,
      [{ user_id: 'u1', status: 'tham_gia' }],
      [{ user_id: 'u1', total_joined: 5, current_streak: 3, best_streak: 3 }]
    );
    const p = patches.find(p => p.user_id === 'u1');
    expect(p.total_joined).toBe(6);
    expect(p.current_streak).toBe(4);
    expect(p.best_streak).toBe(4);
  });

  // EP: đến trễ cũng tính present
  it('tre → tính là present, streak tăng', () => {
    const { patches } = computePatches(
      SESSION_BASE,
      [{ user_id: 'u1', status: 'tre' }],
      [{ user_id: 'u1', total_joined: 0, current_streak: 0, best_streak: 0 }]
    );
    const p = patches.find(p => p.user_id === 'u1');
    expect(p.current_streak).toBe(1);
    expect(p.total_joined).toBe(1);
  });

  // EP: vắng mặt có phép / không phép → không tính total
  it('khong_tham_gia / co_phep / vang → không cập nhật total/streak', () => {
    for (const status of ['khong_tham_gia', 'co_phep', 'vang']) {
      const { patches } = computePatches(
        SESSION_BASE,
        [{ user_id: 'u1', status }],
        [{ user_id: 'u1', total_joined: 5, current_streak: 3, best_streak: 3 }]
      );
      const p = patches.find(p => p.user_id === 'u1');
      expect(p, `status=${status} không nên tạo patch present`).toBeUndefined();
    }
  });

  // EP: eligible rỗng → KHÔNG reset streak bất kỳ ai
  it('eligible_member_ids rỗng → không reset streak', () => {
    const { patches } = computePatches(
      { ...SESSION_BASE, eligible_member_ids: [] },
      [{ user_id: 'u1', status: 'khong_tham_gia' }],
      [{ user_id: 'u1', total_joined: 5, current_streak: 5, best_streak: 5 }]
    );
    // Không có patch nào vì eligible rỗng và u1 không present
    expect(patches.length).toBe(0);
  });

  // EP: eligible có data, member vắng → reset streak
  it('eligible có data + member vắng → reset streak về 0', () => {
    const { patches } = computePatches(
      { ...SESSION_BASE, eligible_member_ids: ['u1'] },
      [{ user_id: 'u1', status: 'khong_tham_gia' }],
      [{ user_id: 'u1', total_joined: 5, current_streak: 3, best_streak: 5 }]
    );
    const p = patches.find(p => p.user_id === 'u1');
    expect(p.current_streak).toBe(0);
    expect(p.best_streak).toBe(5);   // best_streak KHÔNG giảm
    expect(p.total_joined).toBe(5);  // total KHÔNG giảm
  });

  // BVA: streak đã = 0, vắng → không tạo patch reset thừa
  it('member streak=0, vắng → không patch (tránh noise)', () => {
    const { patches } = computePatches(
      { ...SESSION_BASE, eligible_member_ids: ['u1'] },
      [],
      [{ user_id: 'u1', total_joined: 5, current_streak: 0, best_streak: 5 }]
    );
    expect(patches.length).toBe(0);
  });

  // BVA: member eligible không có trong statsCache (member mới)
  it('member eligible mới (không có stats) vắng → không crash, không patch', () => {
    expect(() => computePatches(
      { ...SESSION_BASE, eligible_member_ids: ['u_new'] },
      [],
      []
    )).not.toThrow();
    const { patches } = computePatches(
      { ...SESSION_BASE, eligible_member_ids: ['u_new'] },
      [],
      []
    );
    expect(patches.length).toBe(0);
  });

  // BVA: phiên 0 người tham dự
  it('attended rỗng → statsMap và patches đều rỗng', () => {
    const { statsMap, patches } = computePatches(SESSION_BASE, [], []);
    expect(statsMap.size).toBe(0);
    expect(patches.length).toBe(0);
  });

  // BVA: best_streak không giảm khi streak tăng vượt
  it('streak mới > best_streak → best_streak cập nhật', () => {
    const { patches } = computePatches(
      SESSION_BASE,
      [{ user_id: 'u1', status: 'tham_gia' }],
      [{ user_id: 'u1', total_joined: 10, current_streak: 7, best_streak: 7 }]
    );
    const p = patches[0];
    expect(p.current_streak).toBe(8);
    expect(p.best_streak).toBe(8);
  });

  // EP: nhiều người cùng phiên — mix status
  it('multi-user mix status → chỉ present users có patch total', () => {
    const { patches, statsMap } = computePatches(
      { ...SESSION_BASE, eligible_member_ids: ['u1', 'u2', 'u3'] },
      [
        { user_id: 'u1', status: 'tham_gia' },
        { user_id: 'u2', status: 'tre' },
        { user_id: 'u3', status: 'khong_tham_gia' },
      ],
      [
        { user_id: 'u1', total_joined: 1, current_streak: 1, best_streak: 1 },
        { user_id: 'u2', total_joined: 2, current_streak: 2, best_streak: 2 },
        { user_id: 'u3', total_joined: 3, current_streak: 3, best_streak: 5 },
      ]
    );
    expect(statsMap.has('u1')).toBe(true);
    expect(statsMap.has('u2')).toBe(true);
    expect(statsMap.has('u3')).toBe(false); // không present
    const u3patch = patches.find(p => p.user_id === 'u3');
    expect(u3patch?.current_streak).toBe(0);   // streak reset
    expect(u3patch?.best_streak).toBe(5);       // best giữ nguyên
  });
});
