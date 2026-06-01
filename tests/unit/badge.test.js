// tests/unit/badge.test.js
// Thuật toán: Boundary Value Analysis + Decision Table Testing
// Test badge threshold logic — null-safe, idempotent, chính xác boundary
import { describe, it, expect } from 'vitest';

const DEFAULT_BADGES = [
  { threshold:   5, emoji: '🌱', label: 'Lính Mới'     },
  { threshold:  10, emoji: '⭐', label: 'Cần Cù'        },
  { threshold:  20, emoji: '🌟', label: 'Chuyên Cần'    },
  { threshold:  30, emoji: '💪', label: 'Kiên Trì'      },
  { threshold:  50, emoji: '🏆', label: 'Huyền Thoại'   },
  { threshold: 100, emoji: '👑', label: 'Vua Điểm Danh' },
];

/**
 * Pure function tính badge mới cần cấp
 * Trích từ thongBaoHuyHieu để test độc lập
 */
function computeNewBadges(total, existingThresholds, badges = DEFAULT_BADGES) {
  // null-safe earnedSet
  const earnedSet = new Set(
    (existingThresholds ?? []).filter(t => t != null)
  );
  return badges.filter(badge => {
    if (badge.threshold == null) return false;
    return total >= badge.threshold && !earnedSet.has(badge.threshold);
  });
}

describe('Badge — Boundary Value Analysis', () => {
  // BVA: tại đúng threshold
  it('total === threshold → cấp badge', () => {
    const result = computeNewBadges(5, []);
    expect(result.map(b => b.threshold)).toContain(5);
  });

  // BVA: dưới threshold 1 đơn vị
  it('total = threshold - 1 → không cấp badge', () => {
    const result = computeNewBadges(4, []);
    expect(result.map(b => b.threshold)).not.toContain(5);
  });

  // BVA: vượt threshold
  it('total > threshold → vẫn cấp badge (nếu chưa có)', () => {
    const result = computeNewBadges(6, []);
    expect(result.map(b => b.threshold)).toContain(5);
  });

  // Idempotent: đã có badge → không cấp lại
  it('đã có badge threshold=5 → không cấp lại', () => {
    const result = computeNewBadges(10, [5]);
    expect(result.map(b => b.threshold)).not.toContain(5);
    expect(result.map(b => b.threshold)).toContain(10);
  });

  // Null-safe: threshold undefined trong earnedSet
  it('existing có undefined threshold → không crash, bỏ qua đúng', () => {
    expect(() => computeNewBadges(10, [undefined, null, 5])).not.toThrow();
    const result = computeNewBadges(10, [undefined, null, 5]);
    expect(result.map(b => b.threshold)).toContain(10);
    expect(result.map(b => b.threshold)).not.toContain(5);
  });

  // Null-safe: badge definition có threshold null → skip
  it('badge definition có threshold null → skip không crash', () => {
    const badBadges = [...DEFAULT_BADGES, { threshold: null, emoji: '❓', label: 'Bad' }];
    expect(() => computeNewBadges(100, [], badBadges)).not.toThrow();
    const result = computeNewBadges(100, [], badBadges);
    expect(result.find(b => b.threshold == null)).toBeUndefined();
  });

  // Decision table: total=0 → không badge nào
  it('total=0 → không badge nào', () => {
    expect(computeNewBadges(0, [])).toHaveLength(0);
  });

  // BVA: total=100 với không có badge nào → cấp tất cả 6
  it('total=100 + không có badge trước → cấp đúng 6 badge', () => {
    const result = computeNewBadges(100, []);
    expect(result).toHaveLength(6);
  });

  // BVA: total=100 đã có tất cả → không cấp thêm
  it('total=100 + đã có tất cả → không cấp thêm', () => {
    const allThresholds = DEFAULT_BADGES.map(b => b.threshold);
    expect(computeNewBadges(100, allThresholds)).toHaveLength(0);
  });

  // Multi-milestone: total=20 → cấp 5, 10, 20 cùng lúc
  it('total=20 → cấp đúng 3 badge (5, 10, 20)', () => {
    const result = computeNewBadges(20, []);
    expect(result.map(b => b.threshold).sort((a,b)=>a-b)).toEqual([5, 10, 20]);
  });
});
