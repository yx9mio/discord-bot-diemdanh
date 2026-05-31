// db.js — Supabase client + data access layer
// PERF H-4: thêm batchUpsertMemberStats() — bulk upsert 1 query thay vì N queries
'use strict';
const { createClient } = require('@supabase/supabase-js');
const log = require('./utils/logger.js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
);

// ─── Error helper ─────────────────────────────────────────────────────────────
function throwIfError(error, fn) {
  if (error) {
    log.error('DB', null, '[%s] %s', fn, error.message);
    throw error;
  }
}

// ─── Session helpers ──────────────────────────────────────────────────────────
function getDefaultSession() { return null; }

async function getActiveSession(guildId) {
  const { data, error } = await supabase
    .from('sessions').select('*')
    .eq('guild_id', guildId)
    .eq('is_active', true)
    .eq('cancelled', false)
    .maybeSingle();
  throwIfError(error, 'getActiveSession');
  return data;
}

/**
 * Phase 11.2 — Lấy tất cả phiên đang mở trên mọi guild trong 1 query.
 */
async function getAllActiveSessions() {
  const { data, error } = await supabase
    .from('sessions').select('*')
    .eq('is_active', true)
    .eq('cancelled', false);
  throwIfError(error, 'getAllActiveSessions');
  return data ?? [];
}

async function getSessionById(sessionId, guildId) {
  const { data, error } = await supabase
    .from('sessions').select('*').eq('id', sessionId).eq('guild_id', guildId).eq('cancelled', false).maybeSingle();
  throwIfError(error, 'getSessionById');
  return data;
}

async function getSessionByIdRaw(sessionId, guildId) {
  const { data, error } = await supabase
    .from('sessions').select('*').eq('id', sessionId).eq('guild_id', guildId).maybeSingle();
  throwIfError(error, 'getSessionByIdRaw');
  return data;
}

async function createSession(guildId, sessionName, startedBy, autoCloseAt = null, channelId = null, eligibleMemberIds = null) {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      guild_id: guildId,
      session_name: sessionName,
      started_by: startedBy,
      auto_close_at: autoCloseAt ?? null,
      channel_id: channelId ?? null,
      eligible_member_ids: eligibleMemberIds ?? null,
    })
    .select().single();
  throwIfError(error, 'createSession');
  return data;
}

async function updateSessionMessageId(sessionId, messageId) {
  const { error } = await supabase.from('sessions').update({ message_id: messageId }).eq('id', sessionId);
  throwIfError(error, 'updateSessionMessageId');
}

async function endSession(sessionId) {
  const { error } = await supabase
    .from('sessions').update({ is_active: false, ended_at: new Date().toISOString() }).eq('id', sessionId);
  throwIfError(error, 'endSession');
}

async function cancelSession(sessionId) {
  const { error } = await supabase
    .from('sessions').update({ is_active: false, cancelled: true, ended_at: new Date().toISOString() }).eq('id', sessionId);
  throwIfError(error, 'cancelSession');
}

// ─── Attendance ───────────────────────────────────────────────────────────────
async function getAttendance(sessionId, userId) {
  const { data, error } = await supabase
    .from('attendance').select('*').eq('session_id', sessionId).eq('user_id', userId).maybeSingle();
  throwIfError(error, 'getAttendance');
  return data;
}

async function getAttendances(sessionId) {
  const { data, error } = await supabase
    .from('attendance').select('*').eq('session_id', sessionId);
  throwIfError(error, 'getAttendances');
  return data ?? [];
}

async function markAttendance(sessionId, userId, status, markedBy = null) {
  const { error } = await supabase
    .from('attendance')
    .upsert({ session_id: sessionId, user_id: userId, status, marked_by: markedBy }, { onConflict: 'session_id,user_id' });
  throwIfError(error, 'markAttendance');
}

// ─── Member stats ─────────────────────────────────────────────────────────────
async function getMemberStats(guildId, userId) {
  const { data, error } = await supabase
    .from('member_stats').select('*').eq('guild_id', guildId).eq('user_id', userId).maybeSingle();
  throwIfError(error, 'getMemberStats');
  return data;
}

async function upsertMemberStats(guildId, userId, patch) {
  const { error } = await supabase
    .from('member_stats')
    .upsert({ guild_id: guildId, user_id: userId, ...patch }, { onConflict: 'guild_id,user_id' });
  throwIfError(error, 'upsertMemberStats');
}

/**
 * PERF H-4: Bulk upsert member stats trong 1 Supabase query.
 * @param {string} guildId
 * @param {Array<{user_id, total_joined, current_streak, max_streak, last_session_id}>} patches
 */
async function batchUpsertMemberStats(guildId, patches) {
  if (!patches.length) return;
  const rows = patches.map(p => ({ guild_id: guildId, ...p }));
  const { error } = await supabase
    .from('member_stats')
    .upsert(rows, { onConflict: 'guild_id,user_id' });
  throwIfError(error, 'batchUpsertMemberStats');
}

async function resetMemberStreak(guildId, userId) {
  const { error } = await supabase
    .from('member_stats')
    .update({ current_streak: 0 })
    .eq('guild_id', guildId).eq('user_id', userId);
  throwIfError(error, 'resetMemberStreak');
}

async function getAllMemberStats(guildId) {
  const { data, error } = await supabase
    .from('member_stats').select('*').eq('guild_id', guildId);
  throwIfError(error, 'getAllMemberStats');
  return data ?? [];
}

// ─── Server / history helpers ─────────────────────────────────────────────────
async function getSessionHistory(guildId, { limit = 10, offset = 0, since = null } = {}) {
  const { data, error } = await supabase
    .from('sessions').select('id, ended_at, eligible_member_ids')
    .eq('guild_id', guildId).eq('is_active', false).eq('cancelled', false)
    .order('ended_at', { ascending: false })
    .range(offset, offset + limit - 1);
  throwIfError(error, 'getSessionHistory');
  return data ?? [];
}

async function getSessionsWithAttendance(guildId, { limit = 20, since = null } = {}) {
  const { data, error } = await supabase
    .from('sessions').select('*')
    .eq('guild_id', guildId).eq('is_active', false).eq('cancelled', false)
    .order('ended_at', { ascending: false })
    .limit(limit);
  throwIfError(error, 'getSessionsWithAttendance');
  return data ?? [];
}

// ─── Config ───────────────────────────────────────────────────────────────────
async function getConfig(guildId) {
  const { data, error } = await supabase
    .from('guild_configs').select('*').eq('guild_id', guildId).maybeSingle();
  throwIfError(error, 'getConfig');
  return data;
}

async function upsertConfig(guildId, patch) {
  const { error } = await supabase
    .from('guild_configs')
    .upsert({ guild_id: guildId, ...patch }, { onConflict: 'guild_id' });
  throwIfError(error, 'upsertConfig');
}

// alias — một số handler cũ gọi updateConfig thay vì upsertConfig
const updateConfig = upsertConfig;

// ─── Badges ───────────────────────────────────────────────────────────────────
async function getBadgesForSession(guildId, sessionId) {
  const { data: s } = await supabase.from('sessions').select('guild_id').eq('id', sessionId).maybeSingle();
  if (!s) return [];
  const { data, error } = await supabase
    .from('badges').select('*').eq('guild_id', guildId);
  throwIfError(error, 'getBadgesForSession');
  return data ?? [];
}

async function getBadges(guildId) {
  const { data, error } = await supabase
    .from('badges').select('*').eq('guild_id', guildId).order('threshold', { ascending: true });
  throwIfError(error, 'getBadges');
  return data ?? [];
}

async function upsertBadge(guildId, threshold, emoji, label) {
  const { error } = await supabase
    .from('badges')
    .upsert({ guild_id: guildId, threshold, emoji, label }, { onConflict: 'guild_id,threshold' });
  throwIfError(error, 'upsertBadge');
}

async function deleteBadge(guildId, threshold) {
  const { error } = await supabase
    .from('badges').delete().eq('guild_id', guildId).eq('threshold', threshold);
  throwIfError(error, 'deleteBadge');
}

async function getMemberBadges(guildId, userId) {
  const { data, error } = await supabase
    .from('member_badges').select('*').eq('guild_id', guildId).eq('user_id', userId);
  throwIfError(error, 'getMemberBadges');
  return data ?? [];
}

async function upsertMemberBadge(guildId, userId, threshold) {
  const { error } = await supabase
    .from('member_badges')
    .upsert({ guild_id: guildId, user_id: userId, threshold }, { onConflict: 'guild_id,user_id,threshold' });
  throwIfError(error, 'upsertMemberBadge');
}

// ─── Scheduled sessions ───────────────────────────────────────────────────────
async function getScheduledSessions(guildId) {
  const { data, error } = await supabase
    .from('scheduled_sessions').select('*').eq('guild_id', guildId).eq('is_active', true);
  throwIfError(error, 'getScheduledSessions');
  return data ?? [];
}

async function getAllScheduledSessions() {
  const { data, error } = await supabase
    .from('scheduled_sessions').select('*').eq('is_active', true);
  throwIfError(error, 'getAllScheduledSessions');
  return data ?? [];
}

async function getScheduledSessionById(id) {
  const { data, error } = await supabase
    .from('scheduled_sessions').select('*').eq('id', id).maybeSingle();
  throwIfError(error, 'getScheduledSessionById');
  return data;
}

async function createScheduledSession(guildId, patch) {
  const { data, error } = await supabase
    .from('scheduled_sessions').insert({ guild_id: guildId, ...patch }).select().single();
  throwIfError(error, 'createScheduledSession');
  return data;
}

async function updateScheduledSession(id, patch) {
  const { error } = await supabase
    .from('scheduled_sessions').update(patch).eq('id', id);
  throwIfError(error, 'updateScheduledSession');
}

async function deleteScheduledSession(id) {
  const { error } = await supabase
    .from('scheduled_sessions').delete().eq('id', id);
  throwIfError(error, 'deleteScheduledSession');
}

// ─── getLichCoDinh alias (scheduler.js dùng tên này) ─────────────────────────
const getLichCoDinh = getScheduledSessions;

// ─── Exports ──────────────────────────────────────────────────────────────────
const closeSession = endSession;

module.exports = {
  supabase,
  // Session
  getDefaultSession, getActiveSession, getAllActiveSessions,
  getSessionById, getSessionByIdRaw, createSession, updateSessionMessageId, endSession, cancelSession,
  closeSession, getAttendance, markAttendance,
  getAttendances, getSessionHistory, getSessionsWithAttendance,
  // Member
  getMemberStats, upsertMemberStats, batchUpsertMemberStats,
  resetMemberStreak, getAllMemberStats,
  // Config
  getConfig, upsertConfig, updateConfig,
  // Badges
  getBadgesForSession, getBadges, upsertBadge, deleteBadge, getMemberBadges, upsertMemberBadge,
  // Scheduled
  getScheduledSessions, getAllScheduledSessions, getScheduledSessionById,
  createScheduledSession, updateScheduledSession, deleteScheduledSession,
  getLichCoDinh,
};
