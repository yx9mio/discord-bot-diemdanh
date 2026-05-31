// ============================================================
// db.js — Supabase client + toàn bộ thao tác cơ sở dữ liệu
// ============================================================
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('[LỖI NGHIÊM TRỌNG] Thiếu SUPABASE_URL hoặc SUPABASE_KEY trong .env!');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
  realtime: { transport: ws },
});

function throwIfError(error, context) {
  if (error) {
    console.error(`[DB LỖI] ${context}:`, error.message);
    throw error;
  }
}

// ─── Cấu hình Guild ────────────────────────────────────────────────────────────────
function getDefaultConfig(guildId) {
  return { guild_id: guildId, allowed_role_id: null, admin_role_id: null, phai_role_ids: [] };
}

async function getConfig(guildId) {
  const { data, error } = await supabase
    .from('guild_configs').select('*').eq('guild_id', guildId).maybeSingle();
  throwIfError(error, 'getConfig');
  return data ?? getDefaultConfig(guildId);
}

async function setConfig(guildId, updates) {
  const existing = await getConfig(guildId);
  const { error } = await supabase
    .from('guild_configs')
    .upsert({ ...existing, ...updates, guild_id: guildId, updated_at: new Date().toISOString() });
  throwIfError(error, 'setConfig');
}

// ─── Phiên Điểm Danh ──────────────────────────────────────────────────────────────────
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

async function createSession(guildId, { sessionName, roleName, allowedRoleId, eligibleMemberIds, startedBy, autoCloseAt, channelId }) {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      guild_id: guildId, session_name: sessionName, role_name: roleName ?? 'Tất cả',
      allowed_role_id: allowedRoleId ?? null, eligible_member_ids: eligibleMemberIds,
      started_by: startedBy, auto_close_at: autoCloseAt ?? null,
      channel_id: channelId ?? null, message_id: null, is_active: true, cancelled: false,
    }).select().single();
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

// ─── Điểm Danh ───────────────────────────────────────────────────────────────────────────
async function getAttendances(sessionId) {
  const { data, error } = await supabase
    .from('attendances').select('*').eq('session_id', sessionId).order('checked_in_at', { ascending: true });
  throwIfError(error, 'getAttendances');
  return data ?? [];
}

async function upsertAttendance(sessionId, guildId, userId, displayName, status) {
  const { error } = await supabase.from('attendances').upsert({
    session_id: sessionId, guild_id: guildId, user_id: userId,
    username: displayName, status, checked_in_at: new Date().toISOString(),
  }, { onConflict: 'session_id,user_id' });
  throwIfError(error, 'upsertAttendance');
}

async function upsertAttendanceNoTime(sessionId, guildId, userId, displayName, status) {
  const existing = await supabase.from('attendances').select('checked_in_at')
    .eq('session_id', sessionId).eq('user_id', userId).maybeSingle();
  const checkedInAt = existing.data?.checked_in_at ?? new Date().toISOString();
  const { error } = await supabase.from('attendances').upsert({
    session_id: sessionId, guild_id: guildId, user_id: userId,
    username: displayName, status, checked_in_at: checkedInAt,
  }, { onConflict: 'session_id,user_id' });
  throwIfError(error, 'upsertAttendanceNoTime');
}

async function removeAttendance(sessionId, userId) {
  const { error } = await supabase.from('attendances').delete()
    .eq('session_id', sessionId).eq('user_id', userId);
  throwIfError(error, 'removeAttendance');
}

// ─── Thống Kê Thành Viên ──────────────────────────────────────────────────────────────────
async function getMemberStats(guildId, userId) {
  const { data, error } = await supabase.from('member_stats').select('*')
    .eq('guild_id', guildId).eq('user_id', userId).maybeSingle();
  throwIfError(error, 'getMemberStats');
  return data ?? { guild_id: guildId, user_id: userId, total_sessions: 0, total_joined: 0, current_streak: 0, best_streak: 0 };
}

async function updateMemberStats(guildId, userId, joined, sessionId) {
  const existing = await getMemberStats(guildId, userId);
  const newTotal  = existing.total_sessions + 1;
  const newJoined = joined ? existing.total_joined + 1 : existing.total_joined;
  const newStreak = joined ? existing.current_streak + 1 : 0;
  const newBest   = Math.max(existing.best_streak ?? 0, newStreak);
  const { error } = await supabase.from('member_stats').upsert({
    guild_id: guildId, user_id: userId, total_sessions: newTotal,
    total_joined: newJoined, current_streak: newStreak, best_streak: newBest,
    last_session_id: sessionId, updated_at: new Date().toISOString(),
  });
  throwIfError(error, 'updateMemberStats');
  return { ...existing, total_sessions: newTotal, total_joined: newJoined, current_streak: newStreak, best_streak: newBest };
}

async function recalculateMemberStats(guildId, userId) {
  const { data: sessions, error: sErr } = await supabase
    .from('sessions').select('id, ended_at, eligible_member_ids')
    .eq('guild_id', guildId).eq('is_active', false).eq('cancelled', false)
    .order('ended_at', { ascending: true });
  throwIfError(sErr, 'recalculateMemberStats:sessions');

  const { data: allAtts, error: aErr } = await supabase
    .from('attendances').select('session_id, status')
    .eq('guild_id', guildId).eq('user_id', userId);
  throwIfError(aErr, 'recalculateMemberStats:attendances');
  const attMap = new Map((allAtts ?? []).map(a => [a.session_id, a.status]));

  let total_sessions = 0, total_joined = 0, current_streak = 0, best_streak = 0, last_session_id = null;
  for (const s of sessions ?? []) {
    if (!s.eligible_member_ids.includes(userId)) continue;
    total_sessions++; last_session_id = s.id;
    const status = attMap.get(s.id);
    const joined = status && ['tham_gia', 'tre'].includes(status);
    if (joined) { total_joined++; current_streak++; if (current_streak > best_streak) best_streak = current_streak; }
    else current_streak = 0;
  }

  const { error } = await supabase.from('member_stats').upsert({
    guild_id: guildId, user_id: userId,
    total_sessions, total_joined, current_streak, best_streak, last_session_id,
    updated_at: new Date().toISOString(),
  });
  throwIfError(error, 'recalculateMemberStats:upsert');
}

async function getAllMemberStats(guildId) {
  const { data, error } = await supabase.from('member_stats').select('*')
    .eq('guild_id', guildId).order('total_joined', { ascending: false });
  throwIfError(error, 'getAllMemberStats');
  return data ?? [];
}

async function getTopMembers(guildId, limit = 10) {
  const { data, error } = await supabase.from('member_stats').select('*')
    .eq('guild_id', guildId)
    .order('total_joined', { ascending: false })
    .limit(limit);
  throwIfError(error, 'getTopMembers');
  return data ?? [];
}

async function resetMemberStreak(guildId, userId) {
  const existing = await getMemberStats(guildId, userId);
  const { error } = await supabase.from('member_stats').upsert({
    ...existing, guild_id: guildId, user_id: userId,
    current_streak: 0, updated_at: new Date().toISOString(),
  });
  throwIfError(error, 'resetMemberStreak');
}

// ─── Lịch Sử Phiên ─────────────────────────────────────────────────────────────────────
async function getSessionHistory(guildId, limit = 20) {
  const { data, error } = await supabase.from('sessions').select('*')
    .eq('guild_id', guildId).eq('is_active', false).eq('cancelled', false)
    .order('ended_at', { ascending: false }).limit(limit);
  throwIfError(error, 'getSessionHistory');
  return data ?? [];
}

/**
 * Phase 6: Lấy lịch sử phiên trong khoảng thời gian.
 * @param {string} guildId
 * @param {string|null} since  — ISO timestamp hoặc null (không giới hạn)
 * @param {number} limit
 */
async function getSessionHistoryWithRange(guildId, since = null, limit = 100) {
  let query = supabase.from('sessions').select('*')
    .eq('guild_id', guildId).eq('is_active', false).eq('cancelled', false)
    .order('ended_at', { ascending: false }).limit(limit);
  if (since) query = query.gte('ended_at', since);
  const { data, error } = await query;
  throwIfError(error, 'getSessionHistoryWithRange');
  return data ?? [];
}

/**
 * Phase 6: Lấy tất cả attendance của một danh sách session_ids.
 * Trả về Map<sessionId, attendance[]> để lookup O(1).
 * @param {string[]} sessionIds
 */
async function getAttendanceSummaryForSessions(sessionIds) {
  if (!sessionIds || sessionIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('attendances')
    .select('session_id, user_id, status')
    .in('session_id', sessionIds);
  throwIfError(error, 'getAttendanceSummaryForSessions');
  const map = new Map();
  for (const row of data ?? []) {
    const arr = map.get(row.session_id) ?? [];
    arr.push(row);
    map.set(row.session_id, arr);
  }
  return map;
}

// ─── Lịch Cố Định ────────────────────────────────────────────────────────────────────────
async function getLichCoDinh(guildId) {
  const { data, error } = await supabase.from('scheduled_sessions').select('*')
    .eq('guild_id', guildId).eq('is_active', true)
    .order('day_of_week').order('hour').order('minute');
  throwIfError(error, 'getLichCoDinh');
  return data ?? [];
}

async function getLichCoDinhById(guildId, id) {
  const { data, error } = await supabase.from('scheduled_sessions').select('*')
    .eq('guild_id', guildId).eq('id', id).eq('is_active', true).maybeSingle();
  throwIfError(error, 'getLichCoDinhById');
  return data;
}

async function getLichCoDinhByShortId(guildId, shortId) {
  const { data, error } = await supabase.from('scheduled_sessions').select('*')
    .eq('guild_id', guildId).eq('is_active', true)
    .ilike('id', `${shortId}%`).maybeSingle();
  throwIfError(error, 'getLichCoDinhByShortId');
  return data;
}

async function themLichCoDinh(guildId, { dayOfWeek, hour, minute, sessionName, closeDayOfWeek, closeHour, closeMinute, phaiRoleIds, channelId }) {
  const { data, error } = await supabase.from('scheduled_sessions').insert({
    guild_id: guildId,
    day_of_week: dayOfWeek, hour, minute,
    session_name: sessionName,
    close_day_of_week: closeDayOfWeek ?? null,
    close_hour: closeHour ?? null,
    close_minute: closeMinute ?? null,
    phai_role_ids: phaiRoleIds ?? [],
    channel_id: channelId,
    is_active: true,
  }).select().single();
  throwIfError(error, 'themLichCoDinh');
  return data;
}

async function xoaLichCoDinh(guildId, id) {
  const { data, error } = await supabase.from('scheduled_sessions').update({ is_active: false })
    .eq('guild_id', guildId).eq('id', id).select().maybeSingle();
  throwIfError(error, 'xoaLichCoDinh');
  return !!data;
}

// FEAT 1.4: Cập nhật lịch cố định không cần xóa + tạo lại
async function capNhatLichCoDinh(guildId, id, { sessionName, dayOfWeek, hour, minute, closeDayOfWeek, closeHour, closeMinute, channelId }) {
  const { data, error } = await supabase.from('scheduled_sessions').update({
    session_name:      sessionName,
    day_of_week:       dayOfWeek,
    hour,
    minute,
    close_day_of_week: closeDayOfWeek ?? null,
    close_hour:        closeHour ?? null,
    close_minute:      closeMinute ?? null,
    channel_id:        channelId,
    updated_at:        new Date().toISOString(),
  }).eq('guild_id', guildId).eq('id', id).eq('is_active', true)
    .select().maybeSingle();
  throwIfError(error, 'capNhatLichCoDinh');
  return data ?? null;
}

async function capNhatPhaiRoles(lichId, phaiRoleIds) {
  const { error } = await supabase.from('scheduled_sessions')
    .update({ phai_role_ids: phaiRoleIds })
    .eq('id', lichId);
  throwIfError(error, 'capNhatPhaiRoles');
}

module.exports = {
  supabase,
  getConfig, setConfig,
  getActiveSession, getSessionById, getSessionByIdRaw, createSession, updateSessionMessageId, endSession, cancelSession,
  getAttendances, upsertAttendance, upsertAttendanceNoTime, removeAttendance,
  getMemberStats, updateMemberStats, recalculateMemberStats, getAllMemberStats,
  getTopMembers, resetMemberStreak,
  getSessionHistory, getSessionHistoryWithRange, getAttendanceSummaryForSessions,
  getLichCoDinh, getLichCoDinhById, getLichCoDinhByShortId, themLichCoDinh, xoaLichCoDinh, capNhatLichCoDinh, capNhatPhaiRoles,
};
