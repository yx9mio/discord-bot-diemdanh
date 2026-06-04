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
  const { data, error } = await getClient()
    .from('member_stats').select('*').eq('guild_id', guildId).eq('user_id', userId).maybeSingle();
  _throwSupabase(error, 'getMemberStats');
  return data;
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
  const rows = patches.map(p => ({ ...p, guild_id: guildId }));
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

async function getTopMembers(guildId, limit = 10) {
  const { data, error } = await getClient()
    .from('member_stats').select('*').eq('guild_id', guildId)
    .order('total_joined', { ascending: false }).limit(limit);
  _throwSupabase(error, 'getTopMembers');
  return data ?? [];
}

async function getServerStats(guildId) {
  const [sessionsRes, membersRes, attRes] = await Promise.all([
    getClient().from('sessions').select('id, cancelled', { count: 'exact', head: false })
      .eq('guild_id', guildId).eq('cancelled', false),
    getClient().from('members').select('user_id', { count: 'exact', head: false })
      .eq('guild_id', guildId),
    getClient().from('attendances').select('status', { count: 'exact', head: false })
      .eq('guild_id', guildId),
  ]);
  _throwSupabase(sessionsRes.error, 'getServerStats.sessions');
  _throwSupabase(membersRes.error, 'getServerStats.members');
  _throwSupabase(attRes.error, 'getServerStats.attendances');
  const totalSessions = sessionsRes.count ?? (sessionsRes.data?.length ?? 0);
  const totalMembers  = membersRes.count  ?? (membersRes.data?.length  ?? 0);
  const atts          = attRes.data ?? [];
  const present       = atts.filter(a => a.status === 'tham_gia' || a.status === 'tre').length;
  return {
    total_sessions:    totalSessions,
    total_members:     totalMembers,
    total_attendances: atts.length,
    rate_present:      atts.length ? Math.round((present / atts.length) * 100) : 0,
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
  upsertMemberStats, batchUpsertMemberStats, resetStreak,
  getTopMembers, getServerStats,
  getBadgeDefinitions, getUserBadges, upsertUserBadge,
  getBadges, getMemberBadges, upsertMemberBadge,
  getMemberBadgesMulti, batchUpsertUserBadges,
};
