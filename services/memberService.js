// services/memberService.js — Member stats, badges, leaderboard
'use strict';
const { getClient, _throwSupabase } = require('./_client.js');

// ─── Member CRUD ──────────────────────────────────────────────────────────────
async function getMembers(guildId) {
  const { data, error } = await getClient()
    .from('members').select('*').eq('guild_id', guildId).order('id', { ascending: true });
  _throwSupabase(error, 'getMembers');
  return data ?? [];
}

async function getMember(guildId, userId) {
  const { data, error } = await getClient()
    .from('members').select('*').eq('guild_id', guildId).eq('user_id', userId).maybeSingle();
  _throwSupabase(error, 'getMember');
  return data;
}

async function addMember(payload) {
  const { data, error } = await getClient()
    .from('members').upsert(payload, { onConflict: 'guild_id,user_id' }).select().single();
  _throwSupabase(error, 'addMember');
  return data;
}

async function deleteMember(guildId, userId) {
  const { error } = await getClient()
    .from('members').delete().eq('guild_id', guildId).eq('user_id', userId);
  _throwSupabase(error, 'deleteMember');
}

async function upsertMember({ guildId, userId, phongBan = null, ghiChu = null, username = null, phaiRoleIds = null }) {
  return await addMember({ guild_id: guildId, user_id: userId, phong_ban: phongBan, ghi_chu: ghiChu, username, phai_role_ids: phaiRoleIds });
}

// ─── Member Stats ─────────────────────────────────────────────────────────────
async function getMemberStats(guildId, userId) {
  const [memberRes, statsRes, attRes] = await Promise.all([
    getClient()
      .from('members')
      .select('phong_ban, phai_role_ids')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .maybeSingle(),
    getClient()
      .from('member_stats')
      .select('*')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .maybeSingle(),
    getClient()
      .from('attendances')
      .select('status, sessions!inner(cancelled)')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
  ]);
  _throwSupabase(statsRes.error, 'getMemberStats');
  _throwSupabase(attRes.error, 'getMemberStats.attendance');

  const base = statsRes.data;
  if (!base) return null;

  const atts          = (attRes.data ?? []).filter(a => a.sessions?.cancelled === false);
  const total_late    = atts.filter(a => a.status === 'tre').length;
  const total_absent  = atts.filter(a => a.status === 'khong_tham_gia').length;
  const total_excused = atts.filter(a => a.status === 'co_phep').length;

  return { ...base, phong_ban: memberRes.data?.phong_ban ?? null, phai_role_ids: memberRes.data?.phai_role_ids ?? null, total_late, total_absent, total_excused };
}

async function getMemberStatsMulti(guildId, userIds) {
  if (!userIds?.length) return [];
  const { data, error } = await getClient()
    .from('member_stats')
    .select('user_id, current_streak, best_streak, total_joined, total_sessions, updated_at')
    .eq('guild_id', guildId).in('user_id', userIds);
  _throwSupabase(error, 'getMemberStatsMulti');
  return data ?? [];
}

async function getAllMemberStats(guildId) {
  const [statsRes, membersRes] = await Promise.all([
    getClient()
      .from('member_stats').select('*').eq('guild_id', guildId)
      .order('total_joined', { ascending: false }),
    getClient()
      .from('members').select('user_id, phong_ban').eq('guild_id', guildId),
  ]);
  _throwSupabase(statsRes.error, 'getAllMemberStats');
  const phongMap = new Map((membersRes.data ?? []).map(m => [m.user_id, m.phong_ban]));
  return (statsRes.data ?? []).map(r => ({ ...r, phong_ban: phongMap.get(r.user_id) ?? null }));
}

async function upsertMemberStats(payload) {
  const { data, error } = await getClient()
    .from('member_stats').upsert(payload, { onConflict: 'guild_id,user_id' }).select().single();
  _throwSupabase(error, 'upsertMemberStats');
  return data;
}

async function batchUpsertMemberStats(guildId, patches) {
  if (!patches?.length) return;
  const rows = patches.map(p => ({ guild_id: guildId, ...p }));
  const { error } = await getClient()
    .from('member_stats').upsert(rows, { onConflict: 'guild_id,user_id' });
  _throwSupabase(error, 'batchUpsertMemberStats');
}

async function resetStreak(guildId, userId) {
  const { error } = await getClient()
    .from('member_stats')
    .update({ current_streak: 0, updated_at: new Date().toISOString() })
    .eq('guild_id', guildId).eq('user_id', userId);
  _throwSupabase(error, 'resetStreak');
}

// [FIX] Reset streak toàn bộ members trong 1 query thay vì N queries
async function batchResetStreak(guildId, userIds) {
  if (!userIds?.length) return;
  const { error } = await getClient()
    .from('member_stats')
    .update({ current_streak: 0, updated_at: new Date().toISOString() })
    .eq('guild_id', guildId)
    .in('user_id', userIds);
  _throwSupabase(error, 'batchResetStreak');
}

async function getTopMembers(guildId, limit = 10, phongBan = null, phaiRoleId = null) {
  let phongFilteredIds = null;
  if (phongBan) {
    const { data, error } = await getClient()
      .from('members').select('user_id').eq('guild_id', guildId).eq('phong_ban', phongBan);
    _throwSupabase(error, 'getTopMembers.phongBan');
    phongFilteredIds = (data ?? []).map(m => m.user_id);
    if (!phongFilteredIds.length) return [];
  }

  let phaiFilteredIds = null;
  if (phaiRoleId) {
    const { data, error } = await getClient()
      .from('members').select('user_id').eq('guild_id', guildId).contains('phai_role_ids', [phaiRoleId]);
    _throwSupabase(error, 'getTopMembers.phaiRoleId');
    phaiFilteredIds = (data ?? []).map(m => m.user_id);
    if (!phaiFilteredIds.length) return [];
  }

  let mergedIds = phongFilteredIds;
  if (phaiFilteredIds) {
    mergedIds = mergedIds
      ? mergedIds.filter(id => phaiFilteredIds.includes(id))
      : phaiFilteredIds;
  }
  let query = getClient()
    .from('member_stats').select('*').eq('guild_id', guildId);
  if (mergedIds) query = query.in('user_id', mergedIds);
  query = query.order('total_joined', { ascending: false }).limit(limit);
  const [statsRes, membersRes] = await Promise.all([
    query,
    getClient()
      .from('members').select('user_id, phong_ban, phai_role_ids').eq('guild_id', guildId),
  ]);
  _throwSupabase(statsRes.error, 'getTopMembers');
  const phongMap = new Map((membersRes.data ?? []).map(m => [m.user_id, m.phong_ban]));
  const phaiMap  = new Map((membersRes.data ?? []).map(m => [m.user_id, m.phai_role_ids]));
  return (statsRes.data ?? []).map(r => ({ ...r, phong_ban: phongMap.get(r.user_id) ?? null, phai_role_ids: phaiMap.get(r.user_id) ?? null }));
}

async function getTopMembersByPeriod(guildId, startDate, endDate, limit = 10) {
  const { data: sessions, error: sesErr } = await getClient()
    .from('sessions').select('id').eq('guild_id', guildId).eq('cancelled', false)
    .gte('started_at', startDate).lt('started_at', endDate);
  _throwSupabase(sesErr, 'getTopMembersByPeriod.sessions');
  if (!sessions?.length) return [];
  const sessionIds = sessions.map(s => s.id);

  const { data: atts, error: attErr } = await getClient()
    .from('attendances').select('user_id, status')
    .in('session_id', sessionIds);
  _throwSupabase(attErr, 'getTopMembersByPeriod.attendances');

  const userStats = {};
  for (const a of atts ?? []) {
    if (!userStats[a.user_id]) userStats[a.user_id] = { joined: 0, late: 0, absent: 0, excused: 0 };
    userStats[a.user_id].joined++;
    if (a.status === 'tre') userStats[a.user_id].late++;
    else if (a.status === 'khong_tham_gia') userStats[a.user_id].absent++;
    else if (a.status === 'co_phep') userStats[a.user_id].excused++;
  }

  const { data: members } = await getClient()
    .from('members').select('user_id, phong_ban, phai_role_ids').eq('guild_id', guildId);
  const memberMap = new Map((members ?? []).map(m => [m.user_id, m]));

  return Object.entries(userStats)
    .map(([userId, s]) => ({
      user_id: userId, total_joined: s.joined, total_sessions: sessionIds.length,
      total_late: s.late, total_absent: s.absent, total_excused: s.excused,
      current_streak: 0, best_streak: 0,
      phong_ban: memberMap.get(userId)?.phong_ban ?? null,
      phai_role_ids: memberMap.get(userId)?.phai_role_ids ?? null,
    }))
    .sort((a, b) => b.total_joined - a.total_joined)
    .slice(0, limit);
}

async function getDistinctPhongBan(guildId) {
  const { data, error } = await getClient()
    .from('members').select('phong_ban').eq('guild_id', guildId).not('phong_ban', 'is', null);
  _throwSupabase(error, 'getDistinctPhongBan');
  const bans = new Set((data ?? []).map(r => r.phong_ban).filter(Boolean));
  return [...bans].sort();
}

/**
 * getServerStats: breakdown 4 trạng thái (present/late/absent/excused) + rates.
 * Hỗ trợ date-range filtering via startDate/endDate (ISO strings or null).
 */
async function getServerStats(guildId, startDate = null, endDate = null) {
  let sQuery = getClient()
    .from('sessions').select('id').eq('guild_id', guildId).eq('cancelled', false);
  if (startDate) sQuery = sQuery.gte('started_at', startDate);
  if (endDate) sQuery = sQuery.lte('started_at', endDate);

  const [sessionsRes, membersRes] = await Promise.all([
    sQuery,
    getClient().from('members').select('user_id').eq('guild_id', guildId),
  ]);
  _throwSupabase(sessionsRes.error, 'getServerStats.sessions');
  _throwSupabase(membersRes.error, 'getServerStats.members');

  const sessionIds = (sessionsRes.data ?? []).map(s => s.id);
  const totalSessions = sessionIds.length;
  const totalMembers  = membersRes.data?.length ?? 0;

  const { data: attData, error: attError } = sessionIds.length
    ? await getClient()
        .from('attendances').select('status')
        .eq('guild_id', guildId)
        .in('session_id', sessionIds)
    : { data: [], error: null };
  _throwSupabase(attError, 'getServerStats.attendances');

  const atts     = attData ?? [];
  const totalAtt = atts.length;
  const present  = atts.filter(a => a.status === 'tham_gia').length;
  const late     = atts.filter(a => a.status === 'tre').length;
  const absent   = atts.filter(a => a.status === 'khong_tham_gia').length;
  const excused  = atts.filter(a => a.status === 'co_phep').length;

  // tham_gia + trễ đều được tính là có mặt cho tỉ lệ tổng
  const totalPresent = present + late;

  return {
    total_sessions:    totalSessions,
    total_members:     totalMembers,
    total_attendances: totalAtt,
    total_present:     present,
    total_late:        late,
    total_absent:      absent,
    total_excused:     excused,
    rate_present:      totalAtt ? Math.round((totalPresent / totalAtt) * 100) : 0,
    rate_late:         totalAtt ? Math.round((late    / totalAtt) * 100) : 0,
    rate_absent:       totalAtt ? Math.round((absent  / totalAtt) * 100) : 0,
    rate_excused:      totalAtt ? Math.round((excused / totalAtt) * 100) : 0,
  };
}

// ─── Badges ───────────────────────────────────────────────────────────────────
async function getBadgeDefinitions(guildId) {
  const { data, error } = await getClient()
    .from('badges').select('*').eq('guild_id', guildId);
  _throwSupabase(error, 'getBadgeDefinitions');
  return data ?? [];
}

async function getUserBadges(guildId, userId) {
  const [rowsRes, badgesRes] = await Promise.all([
    getClient().from('member_badges').select('*').eq('guild_id', guildId).eq('user_id', userId),
    getClient().from('badges').select('*').eq('guild_id', guildId),
  ]);
  _throwSupabase(rowsRes.error, 'getUserBadges');
  _throwSupabase(badgesRes.error, 'getUserBadges.badges');
  const badgeMap = new Map((badgesRes.data ?? []).map(b => [b.threshold, b]));
  return (rowsRes.data ?? []).map(r => ({ ...r, badges: badgeMap.get(r.threshold) ?? null }));
}

async function upsertUserBadge(payload) {
  const { data, error } = await getClient()
    .from('member_badges').upsert(payload, { onConflict: 'guild_id,user_id,threshold' }).select().single();
  _throwSupabase(error, 'upsertUserBadge');
  return data;
}

const getBadges = getBadgeDefinitions;

async function getMemberBadges(guildId, userId) {
  const rows = await getUserBadges(guildId, userId);
  return rows.filter(r => r.badges != null).map(r => ({ ...r, threshold: r.badges.threshold ?? r.threshold }));
}

const DEFAULT_BADGES = [
  { threshold:   5, emoji: '🌱', label: 'Lính Mới'     },
  { threshold:  10, emoji: '⭐', label: 'Cần Cù'        },
  { threshold:  20, emoji: '🌟', label: 'Chuyên Cần'    },
  { threshold:  30, emoji: '💪', label: 'Kiên Trì'      },
  { threshold:  50, emoji: '🏆', label: 'Huyền Thoại'   },
  { threshold: 100, emoji: '👑', label: 'Vua Điểm Danh' },
];

async function ensureBadgeDefinition(guildId, threshold) {
  const { data } = await getClient()
    .from('badges').select('id').eq('guild_id', guildId).eq('threshold', threshold).maybeSingle();
  if (data) return;
  const badge = DEFAULT_BADGES.find(b => b.threshold === threshold);
  if (!badge) return;
  const { error } = await getClient()
    .from('badges').upsert({ guild_id: guildId, threshold, emoji: badge.emoji, label: badge.label }, { onConflict: 'guild_id,threshold' });
  _throwSupabase(error, 'ensureBadgeDefinition');
}

async function upsertMemberBadge(guildId, userId, threshold) {
  await ensureBadgeDefinition(guildId, threshold);
  return upsertUserBadge({ guild_id: guildId, user_id: userId, threshold });
}

async function getMemberBadgesMulti(guildId, userIds) {
  if (!userIds?.length) return {};
  const [rowsRes, badgesRes] = await Promise.all([
    getClient().from('member_badges').select('*').eq('guild_id', guildId).in('user_id', userIds),
    getClient().from('badges').select('*').eq('guild_id', guildId),
  ]);
  _throwSupabase(rowsRes.error, 'getMemberBadgesMulti');
  _throwSupabase(badgesRes.error, 'getMemberBadgesMulti.badges');
  const badgeMap = new Map((badgesRes.data ?? []).map(b => [b.threshold, b]));
  const result = {};
  for (const row of (rowsRes.data ?? [])) {
    const badge = badgeMap.get(row.threshold);
    if (!badge) continue;
    if (!result[row.user_id]) result[row.user_id] = [];
    result[row.user_id].push({ ...row, badges: badge, threshold: badge.threshold ?? row.threshold });
  }
  return result;
}

async function batchUpsertUserBadges(guildId, badges) {
  if (!badges?.length) return;
  const rows = badges.map(b => ({ guild_id: guildId, user_id: b.user_id, threshold: b.threshold }));
  const { error } = await getClient()
    .from('member_badges').upsert(rows, { onConflict: 'guild_id,user_id,threshold' });
  _throwSupabase(error, 'batchUpsertUserBadges');
}

module.exports = {
  getMembers, getMember, addMember, deleteMember, upsertMember,
  getMemberStats, getMemberStatsMulti, getAllMemberStats,
  upsertMemberStats, batchUpsertMemberStats, resetStreak, batchResetStreak,
  getTopMembers, getTopMembersByPeriod, getDistinctPhongBan, getServerStats,
  getBadgeDefinitions, getBadges, getUserBadges, upsertUserBadge,
  getMemberBadges, upsertMemberBadge, getMemberBadgesMulti, batchUpsertUserBadges,
};
