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

function upsertMember({ guildId, userId, phongBan = null, ghiChu = null, username = null }) {
  return addMember({ guild_id: guildId, user_id: userId, phong_ban: phongBan, ghi_chu: ghiChu, username });
}

// ─── Member Stats ─────────────────────────────────────────────────────────────
async function getMemberStats(guildId, userId) {
  const [statsRes, attRes] = await Promise.all([
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
      .eq('sessions.cancelled', false),
  ]);
  _throwSupabase(statsRes.error, 'getMemberStats');
  _throwSupabase(attRes.error, 'getMemberStats.attendance');

  const base = statsRes.data;
  if (!base) return null;

  const atts          = attRes.data ?? [];
  const total_late    = atts.filter(a => a.status === 'tre').length;
  const total_absent  = atts.filter(a => a.status === 'khong_tham_gia').length;
  const total_excused = atts.filter(a => a.status === 'co_phep').length;

  return { ...base, total_late, total_absent, total_excused };
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
  const { data, error } = await getClient()
    .from('member_stats').select('*').eq('guild_id', guildId)
    .order('total_joined', { ascending: false });
  _throwSupabase(error, 'getAllMemberStats');
  return data ?? [];
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

async function getTopMembers(guildId, limit = 10) {
  const { data, error } = await getClient()
    .from('member_stats').select('*').eq('guild_id', guildId)
    .order('total_joined', { ascending: false }).limit(limit);
  _throwSupabase(error, 'getTopMembers');
  return data ?? [];
}

/**
 * [FIX] getServerStats: dùng data.length thay vì .count để tránh Supabase count quirk
 * khi select có cột cụ thể và head:false.
 * Trả về breakdown đầy đủ 4 trạng thái (present/late/absent/excused) + rates.
 */
async function getServerStats(guildId) {
  const [sessionsRes, membersRes, attRes] = await Promise.all([
    getClient().from('sessions').select('id')
      .eq('guild_id', guildId).eq('cancelled', false),
    getClient().from('members').select('user_id')
      .eq('guild_id', guildId),
    getClient().from('attendances').select('status')
      .eq('guild_id', guildId),
  ]);
  _throwSupabase(sessionsRes.error, 'getServerStats.sessions');
  _throwSupabase(membersRes.error, 'getServerStats.members');
  _throwSupabase(attRes.error, 'getServerStats.attendances');

  const totalSessions = sessionsRes.data?.length  ?? 0;
  const totalMembers  = membersRes.data?.length   ?? 0;
  const atts          = attRes.data ?? [];
  const totalAtt      = atts.length;

  const present = atts.filter(a => a.status === 'tham_gia').length;
  const late    = atts.filter(a => a.status === 'tre').length;
  const absent  = atts.filter(a => a.status === 'khong_tham_gia').length;
  const excused = atts.filter(a => a.status === 'co_phep').length;

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
  const { data, error } = await getClient()
    .from('member_badges').select('*, badges(*)').eq('guild_id', guildId).eq('user_id', userId);
  _throwSupabase(error, 'getUserBadges');
  return data ?? [];
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
  return rows.map(r => ({ ...r, threshold: r.badges?.threshold ?? r.threshold }));
}

function upsertMemberBadge(guildId, userId, threshold) {
  return upsertUserBadge({ guild_id: guildId, user_id: userId, threshold });
}

async function getMemberBadgesMulti(guildId, userIds) {
  if (!userIds?.length) return {};
  const { data, error } = await getClient()
    .from('member_badges').select('*, badges(*)').eq('guild_id', guildId).in('user_id', userIds);
  _throwSupabase(error, 'getMemberBadgesMulti');
  const result = {};
  for (const row of data ?? []) {
    if (!result[row.user_id]) result[row.user_id] = [];
    result[row.user_id].push({ ...row, threshold: row.badges?.threshold ?? row.threshold });
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
  getMembers, addMember, deleteMember, upsertMember,
  getMemberStats, getMemberStatsMulti, getAllMemberStats,
  upsertMemberStats, batchUpsertMemberStats, resetStreak, batchResetStreak,
  getTopMembers, getServerStats,
  getBadgeDefinitions, getBadges, getUserBadges, upsertUserBadge,
  getMemberBadges, upsertMemberBadge, getMemberBadgesMulti, batchUpsertUserBadges,
};
