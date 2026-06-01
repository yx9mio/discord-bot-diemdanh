// db.js — Supabase data access layer
'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const log = require('./utils/logger.js');
const { SessionSchema, AttendanceSchema, safeParse } = require('./utils/validate.js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _throwSupabase(error, ctx) {
  if (error) {
    log.error('DB', null, '[%s] %s', ctx, error.message);
    throw new Error(`[DB:${ctx}] ${error.message}`);
  }
}

function _validateSession(row, ctx) {
  if (!row) return null;
  const v = safeParse(SessionSchema, row);
  if (!v.ok) log.warn('DB', null, '[%s] SessionSchema warn: %s', ctx, v.error);
  return row;
}

function _validateAttendances(rows, ctx) {
  if (!Array.isArray(rows)) return [];
  return rows.filter(row => {
    const v = safeParse(AttendanceSchema, row);
    if (!v.ok) log.warn('DB', null, '[%s] AttendanceSchema warn for user %s: %s', ctx, row?.user_id, v.error);
    return true;
  });
}

// ─── Guild config ─────────────────────────────────────────────────────────────

async function getGuildConfig(guildId) {
  const { data, error } = await supabase
    .from('guild_configs')
    .select('*')
    .eq('guild_id', guildId)
    .maybeSingle();
  _throwSupabase(error, 'getGuildConfig');
  return data;
}

async function upsertGuildConfig(config) {
  const { data, error } = await supabase
    .from('guild_configs')
    .upsert(config, { onConflict: 'guild_id' })
    .select()
    .single();
  _throwSupabase(error, 'upsertGuildConfig');
  return data;
}

// BUG-5 fix: alias getConfig → getGuildConfig
const getConfig = getGuildConfig;

// ─── Sessions ─────────────────────────────────────────────────────────────────

async function createSession(payload) {
  const { data, error } = await supabase
    .from('sessions')
    .insert(payload)
    .select()
    .single();
  _throwSupabase(error, 'createSession');
  return _validateSession(data, 'createSession');
}

async function getActiveSession(guildId) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('guild_id', guildId)
    .eq('is_active', true)
    .eq('cancelled', false)
    .maybeSingle();
  _throwSupabase(error, 'getActiveSession');
  return _validateSession(data, 'getActiveSession');
}

async function getSessionById(sessionId) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  _throwSupabase(error, 'getSessionById');
  return _validateSession(data, 'getSessionById');
}

async function getSessionByMessageId(messageId) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('message_id', messageId)
    .maybeSingle();
  _throwSupabase(error, 'getSessionByMessageId');
  return _validateSession(data, 'getSessionByMessageId');
}

async function closeSession(sessionId) {
  const { data, error } = await supabase
    .from('sessions')
    .update({ is_active: false, ended_at: new Date().toISOString() })
    .eq('id', sessionId)
    .select()
    .single();
  _throwSupabase(error, 'closeSession');
  return _validateSession(data, 'closeSession');
}

async function cancelSession(sessionId) {
  const { data, error } = await supabase
    .from('sessions')
    .update({ is_active: false, cancelled: true, ended_at: new Date().toISOString() })
    .eq('id', sessionId)
    .select()
    .single();
  _throwSupabase(error, 'cancelSession');
  return _validateSession(data, 'cancelSession');
}

async function updateSessionMessage(sessionId, messageId) {
  const { error } = await supabase
    .from('sessions')
    .update({ message_id: messageId })
    .eq('id', sessionId);
  _throwSupabase(error, 'updateSessionMessage');
}

async function updateSessionName(sessionId, newName) {
  const { data, error } = await supabase
    .from('sessions')
    .update({ session_name: newName })
    .eq('id', sessionId)
    .select()
    .single();
  _throwSupabase(error, 'updateSessionName');
  return _validateSession(data, 'updateSessionName');
}

async function updateSessionEligible(sessionId, memberIds) {
  const { data, error } = await supabase
    .from('sessions')
    .update({ eligible_member_ids: memberIds })
    .eq('id', sessionId)
    .select()
    .single();
  _throwSupabase(error, 'updateSessionEligible');
  return _validateSession(data, 'updateSessionEligible');
}

async function getRecentSessions(guildId, limit = 10) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('guild_id', guildId)
    .eq('cancelled', false)
    .order('created_at', { ascending: false })
    .limit(limit);
  _throwSupabase(error, 'getRecentSessions');
  if (!data) return [];
  data.forEach(row => _validateSession(row, 'getRecentSessions'));
  return data;
}

async function getAllSessions(guildId) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('guild_id', guildId)
    .eq('cancelled', false)
    .order('created_at', { ascending: false });
  _throwSupabase(error, 'getAllSessions');
  if (!data) return [];
  data.forEach(row => _validateSession(row, 'getAllSessions'));
  return data;
}

// BUG-4 fix: alias getSessionHistory → getRecentSessions
const getSessionHistory = getRecentSessions;

// ─── Attendances ──────────────────────────────────────────────────────────────

async function upsertAttendance(payload) {
  const { data, error } = await supabase
    .from('attendances')
    .upsert(payload, { onConflict: 'session_id,user_id' })
    .select()
    .single();
  _throwSupabase(error, 'upsertAttendance');
  return data;
}

async function upsertAttendanceNoTime(sessionId, guildId, userId, username, status, markedBy) {
  const { data, error } = await supabase
    .from('attendances')
    .upsert(
      { session_id: sessionId, guild_id: guildId, user_id: userId, username, status, marked_by: markedBy },
      { onConflict: 'session_id,user_id', ignoreDuplicates: false }
    )
    .select()
    .single();
  _throwSupabase(error, 'upsertAttendanceNoTime');
  return data;
}

async function getAttendances(sessionId) {
  const { data, error } = await supabase
    .from('attendances')
    .select('user_id, username, status, marked_by, checked_in_at')
    .eq('session_id', sessionId);
  _throwSupabase(error, 'getAttendances');
  return _validateAttendances(data ?? [], 'getAttendances');
}

async function getAttendancesByUser(guildId, userId, limit = 50) {
  const { data, error } = await supabase
    .from('attendances')
    .select('session_id, status, checked_in_at, sessions!inner(session_name, created_at, cancelled)')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .eq('sessions.cancelled', false)
    .order('checked_in_at', { ascending: false })
    .limit(limit);
  _throwSupabase(error, 'getAttendancesByUser');
  return data ?? [];
}

async function getAttendanceStats(guildId, userId) {
  const { data, error } = await supabase
    .from('attendances')
    .select('status, sessions!inner(cancelled)')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .eq('sessions.cancelled', false);
  _throwSupabase(error, 'getAttendanceStats');
  return data ?? [];
}

// ─── Member stats ─────────────────────────────────────────────────────────────

async function getMemberStats(guildId, userId) {
  const { data, error } = await supabase
    .from('member_stats')
    .select('*')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .maybeSingle();
  _throwSupabase(error, 'getMemberStats');
  return data;
}

async function getMemberStatsMulti(guildId, userIds) {
  if (!userIds?.length) return [];
  const { data, error } = await supabase
    .from('member_stats')
    .select('user_id, current_streak, best_streak, total_joined, total_sessions, updated_at')
    .eq('guild_id', guildId)
    .in('user_id', userIds);
  _throwSupabase(error, 'getMemberStatsMulti');
  return data ?? [];
}

async function getAllMemberStats(guildId) {
  const { data, error } = await supabase
    .from('member_stats')
    .select('*')
    .eq('guild_id', guildId)
    .order('total_joined', { ascending: false });
  _throwSupabase(error, 'getAllMemberStats');
  return data ?? [];
}

async function upsertMemberStats(payload) {
  const { data, error } = await supabase
    .from('member_stats')
    .upsert(payload, { onConflict: 'guild_id,user_id' })
    .select()
    .single();
  _throwSupabase(error, 'upsertMemberStats');
  return data;
}

async function batchUpsertMemberStats(guildId, patches) {
  if (!patches?.length) return;
  const rows = patches.map(p => ({ ...p, guild_id: guildId }));
  const { error } = await supabase
    .from('member_stats')
    .upsert(rows, { onConflict: 'guild_id,user_id' });
  _throwSupabase(error, 'batchUpsertMemberStats');
}

// ─── Badges ───────────────────────────────────────────────────────────────────

async function getBadgeDefinitions(guildId) {
  const { data, error } = await supabase
    .from('badges')
    .select('*')
    .eq('guild_id', guildId);
  _throwSupabase(error, 'getBadgeDefinitions');
  return data ?? [];
}

async function getUserBadges(guildId, userId) {
  const { data, error } = await supabase
    .from('member_badges')
    .select('*, badges(*)')
    .eq('guild_id', guildId)
    .eq('user_id', userId);
  _throwSupabase(error, 'getUserBadges');
  return data ?? [];
}

async function upsertUserBadge(payload) {
  const { data, error } = await supabase
    .from('member_badges')
    .upsert(payload, { onConflict: 'guild_id,user_id,threshold' })
    .select()
    .single();
  _throwSupabase(error, 'upsertUserBadge');
  return data;
}

const getBadges = getBadgeDefinitions;

async function getMemberBadges(guildId, userId) {
  const rows = await getUserBadges(guildId, userId);
  return rows.map(r => ({
    ...r,
    threshold: r.badges?.threshold ?? r.threshold,
  }));
}

async function upsertMemberBadge(guildId, userId, threshold) {
  return upsertUserBadge({ guild_id: guildId, user_id: userId, threshold });
}

// ─── Scheduled sessions (replaces lich_co_dinh) ───────────────────────────────

/**
 * Lấy tất cả lịch active của guild.
 * Shape trả về tương thích với reminderScheduler:
 *   { id, guild_id, session_name, channel_id, allowed_role_id,
 *     day_of_week, hour, minute,
 *     close_day_of_week, close_hour, close_minute,
 *     is_active, phai_role_ids,
 *     reminder_enabled, reminder_1_min, reminder_2_min, skip_until }
 */
async function getScheduledSessions(guildId) {
  const { data, error } = await supabase
    .from('scheduled_sessions')
    .select('*')
    .eq('guild_id', guildId)
    .eq('is_active', true);
  _throwSupabase(error, 'getScheduledSessions');
  return data ?? [];
}

async function getScheduledSessionById(id) {
  const { data, error } = await supabase
    .from('scheduled_sessions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  _throwSupabase(error, 'getScheduledSessionById');
  return data;
}

async function createScheduledSession(payload) {
  const { data, error } = await supabase
    .from('scheduled_sessions')
    .insert(payload)
    .select()
    .single();
  _throwSupabase(error, 'createScheduledSession');
  return data;
}

async function updateScheduledSession(id, payload) {
  const { data, error } = await supabase
    .from('scheduled_sessions')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  _throwSupabase(error, 'updateScheduledSession');
  return data;
}

async function deleteScheduledSession(id) {
  const { error } = await supabase
    .from('scheduled_sessions')
    .delete()
    .eq('id', id);
  _throwSupabase(error, 'deleteScheduledSession');
}

/**
 * Bỏ qua phiên cho đến một thời điểm (skip_until).
 * Truyền null để bỏ skip.
 */
async function skipScheduledSession(id, skipUntil) {
  const { data, error } = await supabase
    .from('scheduled_sessions')
    .update({ skip_until: skipUntil })
    .eq('id', id)
    .select()
    .single();
  _throwSupabase(error, 'skipScheduledSession');
  return data;
}

// Aliases tương thích với lichcodinh.js handler
const getLichCoDinh        = getScheduledSessions;
const getLichCoDinhById    = getScheduledSessionById;
const createLichCoDinh    = createScheduledSession;
const updateLichCoDinh    = updateScheduledSession;
const deleteLichCoDinh    = deleteScheduledSession;

async function themLichCoDinh(guildId, { dayOfWeek, hour, minute, sessionName, closeDayOfWeek, closeHour, closeMinute, phaiRoleIds, channelId, allowedRoleId, reminder1Min, reminder2Min }) {
  return createScheduledSession({
    guild_id:           guildId,
    day_of_week:        dayOfWeek,
    hour,
    minute,
    session_name:       sessionName ?? 'Điểm danh',
    close_day_of_week:  closeDayOfWeek ?? null,
    close_hour:         closeHour ?? null,
    close_minute:       closeMinute ?? null,
    phai_role_ids:      phaiRoleIds ?? [],
    allowed_role_id:    allowedRoleId ?? null,
    channel_id:         channelId,
    is_active:          true,
    reminder_enabled:   true,
    reminder_1_min:     reminder1Min ?? 30,
    reminder_2_min:     reminder2Min ?? 10,
  });
}

async function suaLichCoDinh(guildId, id, { dayOfWeek, hour, minute, sessionName, closeDayOfWeek, closeHour, closeMinute, channelId, allowedRoleId, reminder1Min, reminder2Min }) {
  return updateScheduledSession(id, {
    day_of_week:       dayOfWeek,
    hour,
    minute,
    session_name:      sessionName,
    close_day_of_week: closeDayOfWeek ?? null,
    close_hour:        closeHour ?? null,
    close_minute:      closeMinute ?? null,
    channel_id:        channelId,
    allowed_role_id:   allowedRoleId ?? null,
    reminder_1_min:    reminder1Min ?? undefined,
    reminder_2_min:    reminder2Min ?? undefined,
  });
}

async function xoaLichCoDinh(guildId, id) {
  return deleteScheduledSession(id);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Guild config
  getGuildConfig, upsertGuildConfig,
  getConfig,

  // Sessions
  createSession, getActiveSession, getSessionById, getSessionByMessageId,
  closeSession, cancelSession,
  updateSessionMessage, updateSessionName, updateSessionEligible,
  getRecentSessions, getAllSessions,
  getSessionHistory,

  // Attendances
  upsertAttendance, upsertAttendanceNoTime,
  getAttendances, getAttendancesByUser, getAttendanceStats,

  // Member stats
  getMemberStats, getMemberStatsMulti, getAllMemberStats,
  upsertMemberStats, batchUpsertMemberStats,

  // Badges
  getBadgeDefinitions, getUserBadges, upsertUserBadge,
  getBadges,
  getMemberBadges, upsertMemberBadge,

  // Scheduled sessions (bảng chính)
  getScheduledSessions, getScheduledSessionById,
  createScheduledSession, updateScheduledSession,
  deleteScheduledSession, skipScheduledSession,

  // Aliases tương thích (lichcodinh.js / reminderScheduler.js)
  getLichCoDinh, getLichCoDinhById,
  createLichCoDinh, updateLichCoDinh, deleteLichCoDinh,
  themLichCoDinh, suaLichCoDinh, xoaLichCoDinh,
};
