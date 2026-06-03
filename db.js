// db.js — Supabase data access layer
'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const log = require('./utils/logger.js');
const { addBreadcrumb } = require('./utils/sentry.js');
const { SessionSchema, AttendanceSchema, safeParse } = require('./utils/validate.js');

// ─── Lazy-init Supabase client ─────────────────────────────────────────────────
// Không khởi tạo ngay khi require() để tránh crash trong môi trường test
// (Node.js 20 không có native WebSocket, Supabase Realtime sẽ throw ngay).
// Client chỉ được tạo lần đầu tiên khi một hàm DB thực sự được gọi.
let _supabase = null;
function getClient() {
  if (!_supabase) {
    // Guard: fail fast trong môi trường test/CI không có env
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      throw new Error('[DB] SUPABASE_URL hoặc SUPABASE_KEY chưa được cấu hình. Kiểm tra file .env');
    }
    _supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
  }
  return _supabase;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────────────────────

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

// [BUG-HISTORY] public.sessions thực tế không có created_at, chỉ có started_at.
// Dùng started_at làm mốc thời gian chuẩn cho lịch sử/attendances để khớp schema hiện tại.
const SESSION_TIME_COLUMN = 'started_at';

// ─── Guild config ───────────────────────────────────────────────────────────────────────────────────────
function getGuildConfig(guildId) {
  return getClient()
    .from('guild_configs')
    .select('*')
    .eq('guild_id', guildId)
    .maybeSingle()
    .then(({ data, error }) => { _throwSupabase(error, 'getGuildConfig'); return data; });
}

async function upsertGuildConfig(config) {
  const { data, error } = await getClient()
    .from('guild_configs')
    .upsert(config, { onConflict: 'guild_id' })
    .select()
    .single();
  _throwSupabase(error, 'upsertGuildConfig');
  return data;
}

function setGuildConfig(guildId, patch) {
  return upsertGuildConfig({ ...patch, guild_id: guildId });
}

const getConfig = getGuildConfig;

async function createSession(payload) {
  const row = {
    ...payload,
    guild_id:            payload.guild_id            ?? payload.guildId,
    session_name:        payload.session_name        ?? payload.sessionName,
    eligible_member_ids: payload.eligible_member_ids ?? payload.eligibleMemberIds ?? null,
    phai_role_ids:       payload.phai_role_ids       ?? payload.phaiRoleIds ?? null,
    description:         payload.description         ?? null,
    is_active:           payload.is_active           ?? true,
    cancelled:           payload.cancelled           ?? false,
  };
  delete row.guildId;
  delete row.sessionName;
  delete row.eligibleMemberIds;
  delete row.phaiRoleIds;
  const { data, error } = await getClient()
    .from('sessions')
    .insert(row)
    .select()
    .single();
  _throwSupabase(error, 'createSession');
  addBreadcrumb('session', 'createSession', {
    guildId: row.guild_id,
    sessionName: row.session_name,
  });
  return _validateSession(data, 'createSession');
}

async function getActiveSession(guildId) {
  const { data, error } = await getClient()
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
  const { data, error } = await getClient()
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  _throwSupabase(error, 'getSessionById');
  return _validateSession(data, 'getSessionById');
}

async function getSessionByMessageId(messageId) {
  const { data, error } = await getClient()
    .from('sessions')
    .select('*')
    .eq('message_id', messageId)
    .maybeSingle();
  _throwSupabase(error, 'getSessionByMessageId');
  return _validateSession(data, 'getSessionByMessageId');
}

async function closeSession(sessionId) {
  const { data, error } = await getClient()
    .from('sessions')
    .update({ is_active: false, ended_at: new Date().toISOString() })
    .eq('id', sessionId)
    .select()
    .single();
  _throwSupabase(error, 'closeSession');
  addBreadcrumb('session', 'closeSession', { sessionId });
  return _validateSession(data, 'closeSession');
}

async function cancelSession(sessionId) {
  const { data, error } = await getClient()
    .from('sessions')
    .update({ is_active: false, cancelled: true, ended_at: new Date().toISOString() })
    .eq('id', sessionId)
    .select()
    .single();
  _throwSupabase(error, 'cancelSession');
  return _validateSession(data, 'cancelSession');
}

async function updateSessionMessage(sessionId, msgOrId) {
  const update = typeof msgOrId === 'string' || typeof msgOrId === 'number'
    ? { message_id: String(msgOrId) }
    : {
        ...(msgOrId.messageId  ? { message_id: String(msgOrId.messageId)  } : {}),
        ...(msgOrId.message_id ? { message_id: String(msgOrId.message_id) } : {}),
        ...(msgOrId.channelId  ? { channel_id: String(msgOrId.channelId)  } : {}),
        ...(msgOrId.channel_id ? { channel_id: String(msgOrId.channel_id) } : {}),
      };
  if (!Object.keys(update).length) return;
  const { error } = await getClient()
    .from('sessions')
    .update(update)
    .eq('id', sessionId);
  _throwSupabase(error, 'updateSessionMessage');
}

async function updateSessionName(sessionId, newName) {
  const { data, error } = await getClient()
    .from('sessions')
    .update({ session_name: newName })
    .eq('id', sessionId)
    .select()
    .single();
  _throwSupabase(error, 'updateSessionName');
  return _validateSession(data, 'updateSessionName');
}

async function updateSessionEligible(sessionId, memberIds) {
  const { data, error } = await getClient()
    .from('sessions')
    .update({ eligible_member_ids: memberIds })
    .eq('id', sessionId)
    .select()
    .single();
  _throwSupabase(error, 'updateSessionEligible');
  return _validateSession(data, 'updateSessionEligible');
}

async function getRecentSessions(guildId, limit = 10) {
  const { data, error } = await getClient()
    .from('sessions')
    .select('*')
    .eq('guild_id', guildId)
    .eq('cancelled', false)
    .order(SESSION_TIME_COLUMN, { ascending: false })
    .limit(limit);
  _throwSupabase(error, 'getRecentSessions');
  if (!data) return [];
  data.forEach(row => _validateSession(row, 'getRecentSessions'));
  return data;
}

async function getAllSessions(guildId) {
  const { data, error } = await getClient()
    .from('sessions')
    .select('*')
    .eq('guild_id', guildId)
    .eq('cancelled', false)
    .order(SESSION_TIME_COLUMN, { ascending: false });
  _throwSupabase(error, 'getAllSessions');
  if (!data) return [];
  data.forEach(row => _validateSession(row, 'getAllSessions'));
  return data;
}

const getSessionHistory = getRecentSessions;

async function upsertAttendance(payload) {
  const { data, error } = await getClient()
    .from('attendances')
    .upsert(payload, { onConflict: 'session_id,user_id' })
    .select()
    .single();
  _throwSupabase(error, 'upsertAttendance');
  addBreadcrumb('attendance', 'upsertAttendance', {
    userId: payload.user_id,
    status: payload.status,
  });
  return data;
}

async function upsertAttendanceNoTime(sessionId, guildId, userId, username, status, markedBy) {
  const { data, error } = await getClient()
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
  const { data, error } = await getClient()
    .from('attendances')
    .select('user_id, username, status, marked_by, checked_in_at')
    .eq('session_id', sessionId);
  _throwSupabase(error, 'getAttendances');
  return _validateAttendances(data ?? [], 'getAttendances');
}

async function getAttendancesByUser(guildId, userId, limit = 50) {
  const { data, error } = await getClient()
    .from('attendances')
    .select('session_id, status, checked_in_at, sessions!inner(session_name, started_at, cancelled)')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .eq('sessions.cancelled', false)
    .order('checked_in_at', { ascending: false })
    .limit(limit);
  _throwSupabase(error, 'getAttendancesByUser');
  return data ?? [];
}

async function getAttendanceStats(guildId, userId) {
  const { data, error } = await getClient()
    .from('attendances')
    .select('status, sessions!inner(cancelled)')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .eq('sessions.cancelled', false);
  _throwSupabase(error, 'getAttendanceStats');
  return data ?? [];
}

async function getMemberStats(guildId, userId) {
  const { data, error } = await getClient()
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
  const { data, error } = await getClient()
    .from('member_stats')
    .select('user_id, current_streak, best_streak, total_joined, total_sessions, updated_at')
    .eq('guild_id', guildId)
    .in('user_id', userIds);
  _throwSupabase(error, 'getMemberStatsMulti');
  return data ?? [];
}

async function getAllMemberStats(guildId) {
  const { data, error } = await getClient()
    .from('member_stats')
    .select('*')
    .eq('guild_id', guildId)
    .order('total_joined', { ascending: false });
  _throwSupabase(error, 'getAllMemberStats');
  return data ?? [];
}

async function upsertMemberStats(payload) {
  const { data, error } = await getClient()
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
  const { error } = await getClient()
    .from('member_stats')
    .upsert(rows, { onConflict: 'guild_id,user_id' });
  _throwSupabase(error, 'batchUpsertMemberStats');
}

async function getBadgeDefinitions(guildId) {
  const { data, error } = await getClient()
    .from('badges')
    .select('*')
    .eq('guild_id', guildId);
  _throwSupabase(error, 'getBadgeDefinitions');
  return data ?? [];
}

async function getUserBadges(guildId, userId) {
  const { data, error } = await getClient()
    .from('member_badges')
    .select('*, badges(*)')
    .eq('guild_id', guildId)
    .eq('user_id', userId);
  _throwSupabase(error, 'getUserBadges');
  return data ?? [];
}

async function upsertUserBadge(payload) {
  const { data, error } = await getClient()
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

function upsertMemberBadge(guildId, userId, threshold) {
  return upsertUserBadge({ guild_id: guildId, user_id: userId, threshold });
}

async function getMemberBadgesMulti(guildId, userIds) {
  if (!userIds?.length) return {};
  const { data, error } = await getClient()
    .from('member_badges')
    .select('*, badges(*)')
    .eq('guild_id', guildId)
    .in('user_id', userIds);
  _throwSupabase(error, 'getMemberBadgesMulti');

  const result = {};
  for (const row of data ?? []) {
    if (!result[row.user_id]) {
      result[row.user_id] = [];
    }
    result[row.user_id].push({
      ...row,
      threshold: row.badges?.threshold ?? row.threshold,
    });
  }
  return result;
}

async function batchUpsertUserBadges(guildId, badges) {
  if (!badges?.length) return;
  const rows = badges.map(b => ({ guild_id: guildId, user_id: b.user_id, threshold: b.threshold }));
  const { error } = await getClient()
    .from('member_badges')
    .upsert(rows, { onConflict: 'guild_id,user_id,threshold' });
  _throwSupabase(error, 'batchUpsertUserBadges');
}

async function getScheduledSessions(guildId) {
  const { data, error } = await getClient()
    .from('scheduled_sessions')
    .select('*')
    .eq('guild_id', guildId)
    .eq('is_active', true);
  _throwSupabase(error, 'getScheduledSessions');
  return data ?? [];
}

async function getScheduledSessionById(id) {
  const { data, error } = await getClient()
    .from('scheduled_sessions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  _throwSupabase(error, 'getScheduledSessionById');
  return data;
}

async function createScheduledSession(payload) {
  const { data, error } = await getClient()
    .from('scheduled_sessions')
    .insert(payload)
    .select()
    .single();
  _throwSupabase(error, 'createScheduledSession');
  return data;
}

async function updateScheduledSession(id, payload) {
  const { data, error } = await getClient()
    .from('scheduled_sessions')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  _throwSupabase(error, 'updateScheduledSession');
  return data;
}

async function deleteScheduledSession(id) {
  const { error } = await getClient()
    .from('scheduled_sessions')
    .delete()
    .eq('id', id);
  _throwSupabase(error, 'deleteScheduledSession');
}

async function skipScheduledSession(id, skipUntil) {
  const { data, error } = await getClient()
    .from('scheduled_sessions')
    .update({ skip_until: skipUntil })
    .eq('id', id)
    .select()
    .single();
  _throwSupabase(error, 'skipScheduledSession');
  return data;
}

const getLichCoDinh        = getScheduledSessions;
const getLichCoDinhById    = getScheduledSessionById;
const createLichCoDinh    = createScheduledSession;
const updateLichCoDinh    = updateScheduledSession;
const deleteLichCoDinh    = deleteScheduledSession;

// [FIX-DB] Xóa pre_close_minutes — cột không tồn tại trong scheduled_sessions.
// Schema dùng close_hour/close_minute để auto-close, và reminder_1_min/reminder_2_min
// để nhắc trước khi đóng (default 30 và 10 phút).
function themLichCoDinh(guildId, { dayOfWeek, hour, minute, sessionName, closeDayOfWeek, closeHour, closeMinute, phaiRoleIds, channelId, allowedRoleId, reminder1Min, reminder2Min }) {
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

// [FIX-DB] Xóa pre_close_minutes khỏi update payload.
function suaLichCoDinh(guildId, id, { dayOfWeek, hour, minute, sessionName, closeDayOfWeek, closeHour, closeMinute, channelId, allowedRoleId, reminder1Min, reminder2Min }) {
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

function xoaLichCoDinh(_guildId, id) {
  return deleteScheduledSession(id);
}

async function getMembers(guildId) {
  const { data, error } = await getClient()
    .from('members')
    .select('*')
    .eq('guild_id', guildId)
    .order('id', { ascending: true });
  _throwSupabase(error, 'getMembers');
  return data ?? [];
}

async function addMember(payload) {
  const { data, error } = await getClient()
    .from('members')
    .upsert(payload, { onConflict: 'guild_id,user_id' })
    .select()
    .single();
  _throwSupabase(error, 'addMember');
  return data;
}

async function deleteMember(guildId, userId) {
  const { error } = await getClient()
    .from('members')
    .delete()
    .eq('guild_id', guildId)
    .eq('user_id', userId);
  _throwSupabase(error, 'deleteMember');
}

async function resetStreak(guildId, userId) {
  const { error } = await getClient()
    .from('member_stats')
    .update({ current_streak: 0, updated_at: new Date().toISOString() })
    .eq('guild_id', guildId)
    .eq('user_id', userId);
  _throwSupabase(error, 'resetStreak');
}

async function ensureGuildConfig(guildId) {
  const { data, error } = await getClient()
    .from('guild_configs')
    .upsert({ guild_id: guildId }, { onConflict: 'guild_id', ignoreDuplicates: true })
    .select()
    .single();
  _throwSupabase(error, 'ensureGuildConfig');
  return data;
}

function upsertMember({ guildId, userId, phongBan = null, ghiChu = null, username = null }) {
  return addMember({
    guild_id:    guildId,
    user_id:     userId,
    phong_ban:   phongBan,
    ghi_chu:     ghiChu,
    username,
  });
}

async function getSessionByIdRaw(sessionId, guildId) {
  const { data, error } = await getClient()
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('guild_id', guildId)
    .maybeSingle();
  _throwSupabase(error, 'getSessionByIdRaw');
  return _validateSession(data, 'getSessionByIdRaw');
}

async function getTopMembers(guildId, limit = 10) {
  const { data, error } = await getClient()
    .from('member_stats')
    .select('*')
    .eq('guild_id', guildId)
    .order('total_joined', { ascending: false })
    .limit(limit);
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
    total_sessions:   totalSessions,
    total_members:    totalMembers,
    total_attendances: atts.length,
    rate_present:     atts.length ? Math.round((present / atts.length) * 100) : 0,
  };
}

async function getAllAttendances(guildId, limit = 5000) {
  const { data, error } = await getClient()
    .from('attendances')
    .select('user_id, username, status, session_id, checked_in_at, marked_by, sessions!inner(session_name, started_at, cancelled)')
    .eq('guild_id', guildId)
    .order('checked_in_at', { ascending: false })
    .limit(limit);
  _throwSupabase(error, 'getAllAttendances');
  return _validateAttendances(data ?? [], 'getAllAttendances');
}

function _hashString(str) {
  const hash = crypto.createHash('md5').update(str).digest();
  return hash.readUInt32BE(0);
}

async function tryAcquireAttendanceLock(sessionId, userId) {
  const key1 = _hashString(sessionId);
  const key2 = _hashString(userId);
  const { data, error } = await getClient().rpc('try_advisory_lock', { key1, key2 });
  _throwSupabase(error, 'tryAcquireAttendanceLock');
  return data === true;
}

async function releaseAttendanceLock(sessionId, userId) {
  const key1 = _hashString(sessionId);
  const key2 = _hashString(userId);
  const { data, error } = await getClient().rpc('advisory_unlock', { key1, key2 });
  _throwSupabase(error, 'releaseAttendanceLock');
  return data === true;
}

module.exports = {
  getGuildConfig, upsertGuildConfig, setGuildConfig,
  getConfig,
  createSession, getActiveSession, getSessionById, getSessionByMessageId,
  closeSession, cancelSession,
  updateSessionMessage, updateSessionName, updateSessionEligible,
  getRecentSessions, getAllSessions,
  getSessionHistory,
  upsertAttendance, upsertAttendanceNoTime,
  getAttendances, getAttendancesByUser, getAttendanceStats,
  getMembers, addMember, deleteMember, resetStreak, upsertMember,
  ensureGuildConfig,
  getSessionByIdRaw,
  getTopMembers,
  getServerStats,
  getAllAttendances,
  tryAcquireAttendanceLock,
  releaseAttendanceLock,
  getMemberStats, getMemberStatsMulti, getAllMemberStats,
  upsertMemberStats, batchUpsertMemberStats,
  getBadgeDefinitions, getUserBadges, upsertUserBadge,
  getBadges,
  getMemberBadges, upsertMemberBadge,
  getMemberBadgesMulti, batchUpsertUserBadges,
  getScheduledSessions, getScheduledSessionById,
  createScheduledSession, updateScheduledSession,
  deleteScheduledSession, skipScheduledSession,
  getLichCoDinh, getLichCoDinhById,
  createLichCoDinh, updateLichCoDinh, deleteLichCoDinh,
  themLichCoDinh, suaLichCoDinh, xoaLichCoDinh,
};
