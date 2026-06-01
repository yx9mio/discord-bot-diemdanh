// db.js — Supabase data access layer
// P1: wrap response qua SessionSchema + AttendanceSchema trước khi return
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

/** Validate session row — log warn nếu shape lạ nhưng vẫn return data gốc */
function _validateSession(row, ctx) {
  if (!row) return null;
  const v = safeParse(SessionSchema, row);
  if (!v.ok) log.warn('DB', null, '[%s] SessionSchema warn: %s', ctx, v.error);
  return row;
}

/** Validate mảng attendance rows */
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
    .from('guild_config')
    .select('*')
    .eq('guild_id', guildId)
    .maybeSingle();
  _throwSupabase(error, 'getGuildConfig');
  return data;
}

async function upsertGuildConfig(config) {
  const { data, error } = await supabase
    .from('guild_config')
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

/**
 * upsertAttendanceNoTime — sửa điểm danh mà không đụng checked_in_at
 * (dùng cho admin override)
 */
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
    .select('user_id, username, status, marked_by, checked_in_at, present_count')
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
    .select('user_id, current_streak, best_streak, total_present, total_sessions, last_present_at')
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
    .order('total_present', { ascending: false });
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

// BUG-3 fix: batch upsert member stats (tránh N+1 trong ketThucPhien)
async function batchUpsertMemberStats(guildId, patches) {
  if (!patches?.length) return;
  const rows = patches.map(p => ({ ...p, guild_id: guildId }));
  const { error } = await supabase
    .from('member_stats')
    .upsert(rows, { onConflict: 'guild_id,user_id' });
  _throwSupabase(error, 'batchUpsertMemberStats');
}

// ─── Badges ───────────────────────────────────────────────────────────────────
// Bảng thực tế: badges (định nghĩa), member_badges (user đạt được)

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

// Aliases dùng trong session.js / badge logic
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

// ─── Lịch cố định ────────────────────────────────────────────────────────────

async function getLichCoDinh(guildId) {
  const { data, error } = await supabase
    .from('lich_co_dinh')
    .select('*')
    .eq('guild_id', guildId)
    .eq('is_active', true);
  _throwSupabase(error, 'getLichCoDinh');
  return data ?? [];
}

async function createLichCoDinh(payload) {
  const { data, error } = await supabase
    .from('lich_co_dinh')
    .insert(payload)
    .select()
    .single();
  _throwSupabase(error, 'createLichCoDinh');
  return data;
}

async function updateLichCoDinh(id, payload) {
  const { data, error } = await supabase
    .from('lich_co_dinh')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  _throwSupabase(error, 'updateLichCoDinh');
  return data;
}

async function deleteLichCoDinh(id) {
  const { error } = await supabase
    .from('lich_co_dinh')
    .delete()
    .eq('id', id);
  _throwSupabase(error, 'deleteLichCoDinh');
}

async function getLichCoDinhById(id) {
  const { data, error } = await supabase
    .from('lich_co_dinh')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  _throwSupabase(error, 'getLichCoDinhById');
  return data;
}

// Aliases dùng bởi lichHandler.js
async function themLichCoDinh(guildId, { dayOfWeek, hour, minute, sessionName, closeDayOfWeek, closeHour, closeMinute, phaiRoleIds, channelId }) {
  return createLichCoDinh({
    guild_id:           guildId,
    day_of_week:        dayOfWeek,
    hour,
    minute,
    session_name:       sessionName,
    close_day_of_week:  closeDayOfWeek ?? null,
    close_hour:         closeHour ?? null,
    close_minute:       closeMinute ?? null,
    phai_role_ids:      phaiRoleIds ?? [],
    channel_id:         channelId,
    is_active:          true,
  });
}

async function suaLichCoDinh(guildId, id, { dayOfWeek, hour, minute, sessionName, closeDayOfWeek, closeHour, closeMinute, channelId }) {
  return updateLichCoDinh(id, {
    day_of_week:       dayOfWeek,
    hour,
    minute,
    session_name:      sessionName,
    close_day_of_week: closeDayOfWeek ?? null,
    close_hour:        closeHour ?? null,
    close_minute:      closeMinute ?? null,
    channel_id:        channelId,
  });
}

async function xoaLichCoDinh(guildId, id) {
  return deleteLichCoDinh(id);
}

// ─── Nhắc nhở ────────────────────────────────────────────────────────────────
// TODO: reminder config chưa có bảng riêng — implement sau khi xác nhận schema

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Guild config
  getGuildConfig, upsertGuildConfig,
  getConfig,                          // BUG-5 alias

  // Sessions
  createSession, getActiveSession, getSessionById,
  closeSession, cancelSession,
  updateSessionMessage, updateSessionName, updateSessionEligible,
  getRecentSessions, getAllSessions,
  getSessionHistory,                  // BUG-4 alias

  // Attendances
  upsertAttendance, upsertAttendanceNoTime,
  getAttendances, getAttendancesByUser, getAttendanceStats,

  // Member stats
  getMemberStats, getMemberStatsMulti, getAllMemberStats,
  upsertMemberStats, batchUpsertMemberStats,  // BUG-3

  // Badges (bảng: badges, member_badges)
  getBadgeDefinitions, getUserBadges, upsertUserBadge,
  getBadges,                          // alias
  getMemberBadges, upsertMemberBadge, // session.js aliases

  // Lịch cố định
  getLichCoDinh, createLichCoDinh, updateLichCoDinh, deleteLichCoDinh, getLichCoDinhById,
  themLichCoDinh, suaLichCoDinh, xoaLichCoDinh,  // lichHandler.js aliases
};
