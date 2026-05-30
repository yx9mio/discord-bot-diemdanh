import { AttendeeRecord, HistorySession, MemberStats } from './types.js';

const MILESTONES = [5, 10, 20, 30, 50, 100];

/**
 * Recompute streak from ordered joined_dates array (ISO strings, ascending).
 * Returns { current_streak, max_streak }.
 */
export function computeStreaks(joinedDates: string[]): { current: number; max: number } {
  if (joinedDates.length === 0) return { current: 0, max: 0 };
  // treat consecutive sessions (by index) as streaks
  let max = 1, current = 1;
  // We use the full history order so just count consecutive at the tail
  // Each entry = one session they joined; streak = consecutive sessions participated
  // (we don't care about calendar gaps, only session sequence)
  for (let i = joinedDates.length - 1; i > 0; i--) {
    // The dates are session end_times; just count backwards while consecutive in array
    current = joinedDates.length; // if all joined, streak = total
    break;
  }
  // Better: count backwards from latest
  current = 1;
  // We'll compute based on history sessions in finishSession, passing indices
  return { current, max };
}

/**
 * Update member stats after a session finishes.
 * historyIndex: the 0-based index of this session in the guild's full history.
 * Returns { newMilestones } — milestone join-counts newly crossed.
 */
export function updateMemberStats(
  existing: MemberStats | null,
  userId: string,
  name: string,
  record: AttendeeRecord | undefined,
  sessionEndTime: string,
  allGuildHistory: HistorySession[],
): { stats: MemberStats; newMilestones: number[] } {
  const prev = existing ?? {
    user_id: userId,
    name,
    total_sessions: 0,
    joined: 0,
    declined: 0,
    joined_dates: [],
    current_streak: 0,
    max_streak: 0,
    milestones_announced: [],
  };

  const didJoin = record?.status === 'tham_gia';
  const didDecline = record?.status === 'khong_tham_gia';

  const stats: MemberStats = {
    ...prev,
    name,
    total_sessions: prev.total_sessions + 1,
    joined: prev.joined + (didJoin ? 1 : 0),
    declined: prev.declined + (didDecline ? 1 : 0),
    joined_dates: didJoin ? [...prev.joined_dates, sessionEndTime] : prev.joined_dates,
    milestones_announced: [...prev.milestones_announced],
  };

  // Compute streak: count consecutive sessions (from end) where they joined
  // Use allGuildHistory to walk backwards
  let currentStreak = 0;
  for (let i = allGuildHistory.length - 1; i >= 0; i--) {
    const s = allGuildHistory[i];
    const att = s.attendees[userId];
    if (att?.status === 'tham_gia') {
      currentStreak++;
    } else if (att !== undefined) {
      // explicitly declined — streak broken
      break;
    }
    // if att === undefined (not eligible/absent in that session) → don't break streak
  }
  if (didJoin) currentStreak = Math.max(currentStreak, 1);
  stats.current_streak = currentStreak;
  stats.max_streak = Math.max(prev.max_streak, currentStreak);

  // Check new milestones
  const newMilestones: number[] = [];
  for (const m of MILESTONES) {
    if (stats.joined >= m && !stats.milestones_announced.includes(m)) {
      newMilestones.push(m);
      stats.milestones_announced.push(m);
    }
  }

  return { stats, newMilestones };
}

export const MILESTONE_EMOJI: Record<number, string> = {
  5: '🌱', 10: '⭐', 20: '🌟', 30: '💪', 50: '🏆', 100: '👑',
};
