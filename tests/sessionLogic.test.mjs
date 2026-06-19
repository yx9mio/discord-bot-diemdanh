import { describe, it, expect } from 'vitest';
import { computeSessionPatches } from '../utils/session.js';

function makeStats(overrides = {}) {
  return {
    user_id: '',
    total_joined: 0,
    current_streak: 0,
    best_streak: 0,
    total_late: 0,
    total_sessions: 0,
    total_absent: 0,
    total_excused: 0,
    ...overrides,
  };
}

function patchOf(patches, userId) {
  return patches.find(p => p.user_id === userId);
}

describe('computeSessionPatches — pure logic', () => {
  it('increments total and streak for present members', () => {
    const attended = [{ user_id: 'u1', status: 'tham_gia' }];
    const allStats = [makeStats({ user_id: 'u1', total_joined: 5, current_streak: 3, best_streak: 8 })];

    const { statsMap, patches } = computeSessionPatches(attended, allStats, [], 's1', 'g1');

    expect(statsMap.get('u1')).toEqual({ total: 6, streak: 4, max: 8 });
    expect(patchOf(patches, 'u1').total_joined).toBe(6);
    expect(patchOf(patches, 'u1').current_streak).toBe(4);
    expect(patchOf(patches, 'u1').best_streak).toBe(8);
  });

  it('counts late members and increments total_late', () => {
    const attended = [{ user_id: 'u1', status: 'tre' }];
    const allStats = [makeStats({ user_id: 'u1', total_joined: 5, current_streak: 3, best_streak: 8, total_late: 1 })];

    const { statsMap, patches } = computeSessionPatches(attended, allStats, [], 's1', 'g1');

    expect(statsMap.get('u1')).toEqual({ total: 6, streak: 4, max: 8 });
    expect(patchOf(patches, 'u1').total_late).toBe(2);
  });

  it('absent member gets total_absent increment, streak unchanged (not in patch)', () => {
    const attended = [{ user_id: 'u1', status: 'khong_tham_gia' }];
    const allStats = [makeStats({ user_id: 'u1', total_joined: 5, current_streak: 3, best_streak: 8 })];

    const { statsMap, patches } = computeSessionPatches(attended, allStats, [], 's1', 'g1');

    expect(statsMap.get('u1')).toBeUndefined();
    const p = patchOf(patches, 'u1');
    expect(p.total_absent).toBe(1);
    expect(p).not.toHaveProperty('current_streak');
    expect(p.total_sessions).toBe(1);
  });

  it('excused member gets total_excused increment', () => {
    const attended = [{ user_id: 'u1', status: 'co_phep' }];
    const allStats = [makeStats({ user_id: 'u1', total_joined: 5, current_streak: 3, best_streak: 8, total_excused: 2 })];

    const { patches } = computeSessionPatches(attended, allStats, [], 's1', 'g1');

    const p = patchOf(patches, 'u1');
    expect(p.total_excused).toBe(3);
    expect(p.total_sessions).toBe(1);
  });

  it('eligible member IN attended list (absent) gets streak reset', () => {
    const attended = [{ user_id: 'u1', status: 'khong_tham_gia' }];
    const allStats = [makeStats({ user_id: 'u1', total_joined: 5, current_streak: 3, best_streak: 8 })];

    const { patches } = computeSessionPatches(attended, allStats, ['u1'], 's1', 'g1');

    const p = patchOf(patches, 'u1');
    expect(p.current_streak).toBe(0);
    expect(p.total_absent).toBe(1);
  });

  it('eligible absent member with streak 0 only increments sessions', () => {
    const allStats = [makeStats({ user_id: 'u1', total_joined: 0, current_streak: 0, best_streak: 0 })];

    const { patches } = computeSessionPatches([], allStats, ['u1'], 's1', 'g1');

    const p = patchOf(patches, 'u1');
    expect(p.current_streak).toBeUndefined();
    expect(p.total_sessions).toBe(1);
    expect(p.total_absent).toBeUndefined();
  });

  it('eligible member NOT in attended list gets streak reset', () => {
    const allStats = [makeStats({ user_id: 'u2', total_joined: 2, current_streak: 1, best_streak: 5 })];
    const attended = [{ user_id: 'u1', status: 'tham_gia' }];

    const { patches } = computeSessionPatches(attended, allStats, ['u2'], 's1', 'g1');

    const p = patchOf(patches, 'u2');
    expect(p.current_streak).toBe(0);
  });

  it('eligible member IN attended list is NOT reset (handled in first loop)', () => {
    const allStats = [makeStats({ user_id: 'u1', total_joined: 5, current_streak: 3, best_streak: 8 })];
    const attended = [{ user_id: 'u1', status: 'tham_gia' }];

    const { patches } = computeSessionPatches(attended, allStats, ['u1'], 's1', 'g1');

    const p = patchOf(patches, 'u1');
    expect(p.current_streak).toBe(4);
    expect(p.total_absent).toBeUndefined();
  });

  it('absent member still gets patch even when not eligible', () => {
    const allStats = [makeStats({ user_id: 'u1', total_joined: 5, current_streak: 3, best_streak: 8 })];
    const attended = [{ user_id: 'u1', status: 'khong_tham_gia' }];

    const { patches } = computeSessionPatches(attended, allStats, [], 's1', 'g1');

    const p = patchOf(patches, 'u1');
    expect(p.total_absent).toBe(1);
    expect(p).not.toHaveProperty('current_streak');
  });

  it('empty eligible_ids does not reset anyone', () => {
    const allStats = [makeStats({ user_id: 'u1', total_joined: 5, current_streak: 3, best_streak: 8 })];

    const { patches } = computeSessionPatches([], allStats, [], 's1', 'g1');

    expect(patches).toHaveLength(0);
  });

  it('handles mix of present, attended-absent, and eligible-absent (not in attended)', () => {
    const allStats = [
      makeStats({ user_id: 'u1', total_joined: 5, current_streak: 3, best_streak: 8 }),
      makeStats({ user_id: 'u2', total_joined: 2, current_streak: 1, best_streak: 5 }),
      makeStats({ user_id: 'u3', total_joined: 1, current_streak: 2, best_streak: 4 }),
    ];
    const attended = [
      { user_id: 'u1', status: 'tham_gia' },
      { user_id: 'u2', status: 'khong_tham_gia' },
    ];

    const { statsMap, patches } = computeSessionPatches(attended, allStats, ['u3'], 's1', 'g1');

    expect(statsMap.get('u1')).toEqual({ total: 6, streak: 4, max: 8 });
    const p2 = patchOf(patches, 'u2');
    expect(p2).not.toHaveProperty('current_streak');
    expect(p2.total_absent).toBe(1);
    const p3 = patchOf(patches, 'u3');
    expect(p3.current_streak).toBe(0);
    expect(p3.total_absent).toBe(1);
  });

  it('eligible absent member NOT in attended has streak reset', () => {
    const allStats = [makeStats({ user_id: 'u2', total_joined: 2, current_streak: 3, best_streak: 5 })];
    const attended = [{ user_id: 'u1', status: 'tham_gia' }];

    const { patches } = computeSessionPatches(attended, allStats, ['u2'], 's1', 'g1');

    const p = patchOf(patches, 'u2');
    expect(p.current_streak).toBe(0);
    expect(p.total_absent).toBe(1);
  });

  it('new member with no stats gets defaults (total:1, streak:1)', () => {
    const { statsMap, patches } = computeSessionPatches(
      [{ user_id: 'new_user', status: 'tham_gia' }],
      [],
      [],
      's1',
      'g1',
    );

    expect(statsMap.get('new_user')).toEqual({ total: 1, streak: 1, max: 1 });
    expect(patches).toHaveLength(1);
    expect(patches[0].total_joined).toBe(1);
  });

  it('sets last_session_id on each patch', () => {
    const attended = [{ user_id: 'u1', status: 'tham_gia' }];
    const allStats = [makeStats({ user_id: 'u1', total_joined: 5 })];

    const { patches } = computeSessionPatches(attended, allStats, [], 's1', 'g1');

    expect(patches[0].last_session_id).toBe('s1');
  });

  it('multiple present members each get correct stats', () => {
    const allStats = [
      makeStats({ user_id: 'u1', total_joined: 10, current_streak: 5, best_streak: 7 }),
      makeStats({ user_id: 'u2', total_joined: 3, current_streak: 2, best_streak: 4 }),
      makeStats({ user_id: 'u3', total_joined: 0, current_streak: 0, best_streak: 0 }),
    ];
    const attended = [
      { user_id: 'u1', status: 'tham_gia' },
      { user_id: 'u2', status: 'tre' },
      { user_id: 'u3', status: 'tham_gia' },
    ];

    const { statsMap, patches } = computeSessionPatches(attended, allStats, [], 's1', 'g1');

    expect(statsMap.get('u1')).toEqual({ total: 11, streak: 6, max: 7 });
    expect(statsMap.get('u2')).toEqual({ total: 4, streak: 3, max: 4 });
    expect(statsMap.get('u3')).toEqual({ total: 1, streak: 1, max: 1 });
    expect(patches).toHaveLength(3);
  });
});
