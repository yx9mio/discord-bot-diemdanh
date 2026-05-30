const MILESTONES = [5, 10, 20, 30, 50, 100];

function updateMemberStats(existing, userId, name, record, sessionEndTime, allGuildHistory) {
  const prev = existing ?? {
    user_id: userId, name, total_sessions: 0, joined: 0, declined: 0,
    joined_dates: [], current_streak: 0, max_streak: 0, milestones_announced: [],
  };
  const didJoin = record?.status === 'tham_gia';
  const didDecline = record?.status === 'khong_tham_gia';
  const stats = {
    ...prev, name,
    total_sessions: prev.total_sessions + 1,
    joined: prev.joined + (didJoin ? 1 : 0),
    declined: prev.declined + (didDecline ? 1 : 0),
    joined_dates: didJoin ? [...prev.joined_dates, sessionEndTime] : prev.joined_dates,
    milestones_announced: [...prev.milestones_announced],
  };
  // Compute streak: walk backwards through history
  let currentStreak = 0;
  for (let i = allGuildHistory.length - 1; i >= 0; i--) {
    const s = allGuildHistory[i];
    const att = s.attendees[userId];
    if (att?.status === 'tham_gia') currentStreak++;
    else if (att !== undefined) break;
  }
  if (didJoin) currentStreak = Math.max(currentStreak, 1);
  stats.current_streak = currentStreak;
  stats.max_streak = Math.max(prev.max_streak, currentStreak);
  const newMilestones = [];
  for (const m of MILESTONES) {
    if (stats.joined >= m && !stats.milestones_announced.includes(m)) {
      newMilestones.push(m);
      stats.milestones_announced.push(m);
    }
  }
  return { stats, newMilestones };
}

const MILESTONE_EMOJI = { 5: '🌱', 10: '⭐', 20: '🌟', 30: '💪', 50: '🏆', 100: '👑' };

module.exports = { updateMemberStats, MILESTONE_EMOJI };
