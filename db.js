// db.js — Supabase client + data access layer
// PERF H-4: thêm batchUpsertMemberStats() — bulk upsert 1 query thay vì N queries
// FIX S-1: createSession nhận object thay vì positional args — khớp với scheduler.js
'use strict';
const { createClient } = require('@supabase/supabase-js');
const ws  = require('ws');
const log = require('./utils/logger.js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    realtime: {
      transport: ws,
    },
  },
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

/**
 * createSession — nhận object để dễ maintain và tránh lỗi thứ tự tham số.
 *
 * @param {object} opts
 * @param {string}   opts.guild_id
 * @param {string}   opts.session_name
 * @param {string}   opts.started_by
 * @param {string|null} [opts.auto_close_at]
 * @param {string|null} [opts.channel_id]
 * @param {string[]|null} [opts.eligible_member_ids]
 * @param {string|null} [opts.allowed_role_id]
 * @param {string|null} [opts.role_name]
 */
async function createSession({
  guild_id,
  session_name,
  started_by,
  auto_close_at        = null,
  channel_id           = null,
  eligible_member_ids  = null,
  allowed_role_id      = null,
  role_name            = null,
} = {}) {
  if (!guild_id)    throw new Error('createSession: guild_id bắt buộc');
  if (!session_name) throw new Error('createSession: session_name bắt buộc');
  if (!started_by)  throw new Error('createSession: started_by bắt buộc');

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      guild_id,
      session_name,
      started_by,
      auto_close_at:       auto_close_at      ?? null,
      channel_id:          channel_id         ?? null,
      eligible_member_ids: eligible_member_ids ?? null,
      allowed_role_id:     allowed_role_id    ?? null,
      role_name:           role_name          ?? null,
    })
    .select().single();
  throwIfError(error, 'createSession');
  return data;
}

async function updateSessionMessageId(sessionId, messageId) {
  const { error } = await supabase.from('sessions').update({ message_id: messageId }).eq('id', sessionId);
  throwIfError(error, 'updateSessionMessageId');
}

// alias dùng trong scheduler
const updateSessionMessage = updateSessionMessageId;

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
    .from('attendances').select('*').eq('session_id', sessionId).eq('user_id', userId).maybeSingle();
  throwIfError(error, 'getAttendance');
  return data;
}

async function getAttendances(sessionId) {
  const { data, error } = await supabase
    .from('attendances').select('*').eq('session_id', sessionId);
  throwIfError(error, 'getAttendances');
  return data ?? [];
}

/**
 * markAttendance — upsert cơ bản, không lưu username/guild_id.
 * Dùng cho các flow cũ (button handler). Ưu tiên dùng upsertAttendance.
 */
async function markAttendance(sessionId, userId, status, markedBy = null) {
  const { error } = await supabase
    .from('attendances')
    .upsert(
      { session_id: sessionId, user_id: userId, status, marked_by: markedBy },
      { onConflict: 'session_id,user_id' },
    );
  throwIfError(error, 'markAttendance');
}

/**
 * upsertAttendance — upsert đầy đủ với username + guild_id + checked_in_at.
 * Dùng cho /diemdanh (self check-in) và /them (admin thêm).
 */
async function upsertAttendance(sessionId, guildId, userId, username, status, markedBy = null) {
  const { error } = await supabase
    .from('attendances')
    .upsert(
      {
        session_id: sessionId,
        guild_id: guildId,
        user_id: userId,
        username,
        status,
        marked_by: markedBy,
        checked_in_at: new Date().toISOString(),
      },
      { onConflict: 'session_id,user_id' },
    );
  throwIfError(error, 'upsertAttendance');
}

/**
 * upsertAttendanceNoTime — upsert với username + guild_id nhưng KHÔNG cập nhật checked_in_at.
 * Dùng cho /sua (admin sửa trạng thái sau điểm danh).
 */
async function upsertAttendanceNoTime(sessionId, guildId, userId, username, status, markedBy = null) {
  const { error } = await supabase
    .from('attendances')
    .upsert(
      {
        session_id: sessionId,
        guild_id: guildId,
        user_id: userId,
        username,
        status,
        marked_by: markedBy,
      },
      { onConflict: 'session_id,user_id', ignoreDuplicates: false },
    );
  throwIfError(error, 'upsertAttendanceNoTime');
}

/**
 * getAttendanceSummaryForSessions — lấy tất cả attendance rows cho list sessionIds.
 * Trả về Map<sessionId, rows[]> để tra cứu nhanh.
 */
async function getAttendanceSummaryForSessions(sessionIds) {
  if (!sessionIds || sessionIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('attendances')
    .select('session_id, user_id, status')
    .in('session_id', sessionIds);
  throwIfError(error, 'getAttendanceSummaryForSessions');
  const map = new Map();
  for (const row of (data ?? [])) {
    if (!map.has(row.session_id)) map.set(row.session_id, []);
    map.get(row.session_id).push(row);
  }
  return map;
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

/**
 * Lấy top N thành viên tích cực nhất, sắp xếp theo total_joined DESC.
 * Column thực tế trong DB: best_streak (không phải max_streak)
 */
async function getTopMembers(guildId, limit = 10) {
  const { data, error } = await supabase
    .from('member_stats')
    .select('user_id, total_joined, total_sessions, current_streak, best_streak')
    .eq('guild_id', guildId)
    .order('total_joined', { ascending: false })
    .limit(limit);
  throwIfError(error, 'getTopMembers');
  return data ?? [];
}

// ─── Server / history helpers ─────────────────────────────────────────────────
async function getSessionHistory(guildId, limitOrOpts = 10) {
  const { limit = 10, offset = 0 } =
    typeof limitOrOpts === 'number' ? { limit: limitOrOpts } : limitOrOpts;
  const { data, error } = await supabase
    .from('sessions')
    .select('id, session_name, ended_at, eligible_member_ids')
    .eq('guild_id', guildId).eq('is_active', false).eq('cancelled', false)
    .order('ended_at', { ascending: false })
    .range(offset, offset + limit - 1);
  throwIfError(error, 'getSessionHistory');
  return data ?? [];
}

/**
 * getSessionHistoryWithRange — lấy lịch sử phiên trong khoảng thời gian.
 */
async function getSessionHistoryWithRange(guildId, since = null, limit = 100) {
  let query = supabase
    .from('sessions')
    .select('id, session_name, ended_at, eligible_member_ids')
    .eq('guild_id', guildId)
    .eq('is_active', false)
    .eq('cancelled', false)
    .order('ended_at', { ascending: false })
    .limit(limit);
  if (since) query = query.gte('ended_at', since);
  const { data, error } = await query;
  throwIfError(error, 'getSessionHistoryWithRange');
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

const getLichCoDinh = getScheduledSessions;

/**
 * themLichCoDinh — alias của createScheduledSession với tham số đặt tên tiếng Việt.
 */
async function themLichCoDinh(guildId, {
  dayOfWeek, hour, minute,
  sessionName,
  closeDayOfWeek = null, closeHour = null, closeMinute = null,
  phaiRoleIds = [],
  channelId = null,
} = {}) {
  return createScheduledSession(guildId, {
    day_of_week:       dayOfWeek,
    hour,
    minute,
    session_name:      sessionName,
    close_day_of_week: closeDayOfWeek,
    close_hour:        closeHour,
    close_minute:      closeMinute,
    phai_role_ids:     phaiRoleIds,
    channel_id:        channelId,
    is_active:         true,
  });
}

/**
 * suaLichCoDinh — Bug 3 fix: update lịch cố định với tham số đặt tên tiếng Việt.
 * Trả về row đã cập nhật.
 */
async function suaLichCoDinh(guildId, lichId, {
  dayOfWeek, hour, minute,
  sessionName,
  closeDayOfWeek = null, closeHour = null, closeMinute = null,
  channelId = null,
} = {}) {
  const patch = {
    day_of_week:       dayOfWeek,
    hour,
    minute,
    session_name:      sessionName,
    close_day_of_week: closeDayOfWeek,
    close_hour:        closeHour,
    close_minute:      closeMinute,
  };
  if (channelId != null) patch.channel_id = channelId;
  const { data, error } = await supabase
    .from('scheduled_sessions')
    .update(patch)
    .eq('id', lichId)
    .eq('guild_id', guildId)
    .select()
    .single();
  throwIfError(error, 'suaLichCoDinh');
  return data;
}

/**
 * xoaLichCoDinh — Bug 3 fix: alias deleteScheduledSession theo tên tiếng Việt.
 */
async function xoaLichCoDinh(guildId, lichId) {
  const { error } = await supabase
    .from('scheduled_sessions')
    .delete()
    .eq('id', lichId)
    .eq('guild_id', guildId);
  throwIfError(error, 'xoaLichCoDinh');
}

// ─── Exports ──────────────────────────────────────────────────────────────────
const closeSession = endSession;

module.exports = {
  supabase,
  getDefaultSession, getActiveSession, getAllActiveSessions,
  getSessionById, getSessionByIdRaw, createSession,
  updateSessionMessageId, updateSessionMessage,
  endSession, cancelSession, closeSession,
  getAttendance, getAttendances,
  markAttendance, upsertAttendance, upsertAttendanceNoTime,
  getAttendanceSummaryForSessions,
  getSessionHistory, getSessionHistoryWithRange, getSessionsWithAttendance,
  getMemberStats, upsertMemberStats, batchUpsertMemberStats,
  resetMemberStreak, getAllMemberStats, getTopMembers,
  getConfig, upsertConfig, updateConfig,
  getBadgesForSession, getBadges, upsertBadge, deleteBadge, getMemberBadges, upsertMemberBadge,
  getScheduledSessions, getAllScheduledSessions, getScheduledSessionById,
  createScheduledSession, updateScheduledSession, deleteScheduledSession,
  getLichCoDinh, themLichCoDinh, suaLichCoDinh, xoaLichCoDinh,
};
