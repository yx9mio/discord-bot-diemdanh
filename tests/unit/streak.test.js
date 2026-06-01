// tests/unit/streak.test.js
// Thuật toán: Equivalence Partitioning + Boundary Value Analysis
// Test ketThucPhien streak/total logic hoàn toàn in-memory (không cần DB/Discord)
import { describe, it, expect } from 'vitest';

// ─── Inline implementation để test pure logic (tách khỏi DB) ───────────────
const PRESENT_STATUSES = new Set(['tham_gia', 'tre']);
