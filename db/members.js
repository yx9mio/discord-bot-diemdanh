// db/members.js — member_stats, badges, members table
'use strict';
const log = require('../utils/logger.js');

function _throwSupabase(error, ctx) {
  if (error) {
    log.error('DB', null, '[%s] %s', ctx, error.message);
    throw new Error(`[DB:${ctx}] ${error.message}`);
  }
}

async function getMemberStats(getClient, guildId, userId) {
  const { data, error } = await getClient().from('member_stats').select('*')
    .eq('guild_id', guildId).eq('user_id', userId).maybeSingle();
  _throwSupabase(error, 'getMemberStats');
  return data;
}

async function getMemberStatsMulti(getClient, guildId, userIds) {
  if (!userIds?.length) return [];
  const { data, error } = await getClient().from('member_stats')
    .select('user_id, current_streak, best_streak, total_joined, total_sessions, updated_at')
    .eq('guild_id', guildId).in('user_id', userIds);
  _throwSupabase(error, 'getMemberStatsMulti');
  return data ?? [];
}

async function getAllMemberStats(getClient, guildId) {
  const { data, error } = await getClient().from('member_stats').select('*')
    .eq('guild_id', guildId).order('total_joined', { ascending: false });
  _throwSupabase(error, 'getAllMemberStats');
  return data ?? [];
}

async function upsertMemberStats(getClient, payload) {
  const { data, error } = await getClient().from('member_stats')
    .upsert(payload, { onConflict: 'guild_id,user_id' }).select().single();
  _throwSupabase(error, 'upsertMemberStats');
  return data;
}

async function batchUpsertMemberStats(getClient, guildId, patches) {
  if (!patches?.length) return;
  const rows = patches.map(p => ({ ...p, guild_id: guildId }));
  const { error } = await getClient().from('member_stats').upsert(rows, { onConflict: 'guild_id,user_id' });
  _throwSupabase(error, 'batchUpsertMemberStats');
}

async function getTopMembers(getClient, guildId, limit = 10) {
  const { data, error } = await getClient().from('member_stats').select('*')
    .eq('guild_id', guildId).order('total_joined', { ascending: false }).limit(limit);
  _throwSupabase(error, 'getTopMembers');
  return data ?? [];
}

async function resetStreak(getClient, guildId, userId) {
  const { error } = await getClient().from('member_stats')
    .update({ current_streak: 0, updated_at: new Date().toISOString() })
    .eq('guild_id', guildId).eq('user_id', userId);
  _throwSupabase(error, 'resetStreak');
}

// ─── Badges ───────────────────────────────────────────────────────────────────
async function getBadgeDefinitions(getClient, guildId) {
  const { data, error } = await getClient().from('badges').select('*').eq('guild_id', guildId);
  _throwSupabase(error, 'getBadgeDefinitions');
  return data ?? [];
}

async function getUserBadges(getClient, guildId, userId) {
  const { data, error } = await getClient().from('member_badges').select('*, badges(*)')
    .eq('guild_id', guildId).eq('user_id', userId);
  _throwSupabase(error, 'getUserBadges');
  return data ?? [];
}

async function upsertUserBadge(getClient, payload) {
  const { data, error } = await getClient().from('member_badges')
    .upsert(payload, { onConflict: 'guild_id,user_id,threshold' }).select().single();
  _throwSupabase(error, 'upsertUserBadge');
  return data;
}

async function getMemberBadges(getClient, guildId, userId) {
  const rows = await getUserBadges(getClient, guildId, userId);
  return rows.map(r => ({ ...r, threshold: r.badges?.threshold ?? r.threshold }));
}

function upsertMemberBadge(getClient, guildId, userId, threshold) {
  return upsertUserBadge(getClient, { guild_id: guildId, user_id: userId, threshold });
}

async function getMemberBadgesMulti(getClient, guildId, userIds) {
  if (!userIds?.length) return {};
  const { data, error } = await getClient().from('member_badges').select('*, badges(*)')
    .eq('guild_id', guildId).in('user_id', userIds);
  _throwSupabase(error, 'getMemberBadgesMulti');
  const result = {};
  for (const row of data ?? []) {
    if (!result[row.user_id]) result[row.user_id] = [];
    result[row.user_id].push({ ...row, threshold: row.badges?.threshold ?? row.threshold });
  }
  return result;
}

async function batchUpsertUserBadges(getClient, guildId, badges) {
  if (!badges?.length) return;
  const rows = badges.map(b => ({ guild_id: guildId, user_id: b.user_id, threshold: b.threshold }));
  const { error } = await getClient().from('member_badges').upsert(rows, { onConflict: 'guild_id,user_id,threshold' });
  _throwSupabase(error, 'batchUpsertUserBadges');
}

// ─── Members table ────────────────────────────────────────────────────────────
async function getMembers(getClient, guildId) {
  const { data, error } = await getClient().from('members').select('*')
    .eq('guild_id', guildId).order('id', { ascending: true });
  _throwSupabase(error, 'getMembers');
  return data ?? [];
}

async function addMember(getClient, payload) {
  const { data, error } = await getClient().from('members')
    .upsert(payload, { onConflict: 'guild_id,user_id' }).select().single();
  _throwSupabase(error, 'addMember');
  return data;
}

async function deleteMember(getClient, guildId, userId) {
  const { error } = await getClient().from('members')
    .delete().eq('guild_id', guildId).eq('user_id', userId);
  _throwSupabase(error, 'deleteMember');
}

function upsertMember(getClient, { guildId, userId, phongBan = null, ghiChu = null, username = null }) {
  return addMember(getClient, { guild_id: guildId, user_id: userId, phong_ban: phongBan, ghi_chu: ghiChu, username });
}

module.exports = {
  getMemberStats, getMemberStatsMulti, getAllMemberStats,
  upsertMemberStats, batchUpsertMemberStats,
  getTopMembers, resetStreak,
  getBadgeDefinitions, getUserBadges, upsertUserBadge,
  getMemberBadges, upsertMemberBadge,
  getMemberBadgesMulti, batchUpsertUserBadges,
  getMembers, addMember, deleteMember, upsertMember,
};
