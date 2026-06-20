// services/attendanceService.js — Data access cho điểm danh
'use strict';
const { addBreadcrumb } = require('../utils/sentry.js');
const { getClient, _throwSupabase, _validateAttendances } = require('./_client.js');

// ─── Distributed Lock ────────────────────────────────────────────────────────
// Dùng bảng attendance_locks + INSERT ON CONFLICT DO NOTHING để lock distributed.
// Hoạt động với mọi connection pool (PostgREST, PgBouncer, multi-instance).
// Không dùng pg_try_advisory_lock vì session-level lock không qua được pool.
// Map L1 tốc độ cao check nhanh trước khi gọi DB (tránh spam DB).
const _locksL1 = new Map();       // in-memory L1 fast check
const L1_TTL_MS = 30_000;        // L1 lock expires after 30s (DB tự cleanup sau 60s)

function _tryAcquireL1(sessionId, userId) {
  const key = `${sessionId}:${userId}`;
  if (_locksL1.has(key)) {
    const ts = _locksL1.get(key);
    if (Date.now() - ts < L1_TTL_MS) return false;
  }
  _locksL1.set(key, Date.now());
  return true;
}

function _releaseL1(sessionId, userId) {
  _locksL1.delete(`${sessionId}:${userId}`);
}

// DB-backed distributed lock (L2).
// Trả về true nếu acquire thành công, false nếu đã bị lock (instance khác).
async function _tryAcquireL2(sessionId, userId) {
  try {
    await getClient().rpc('cleanup_stale_locks');
  } catch {} // cleanup best-effort

  const { error: lockErr } = await getClient()
    .from('attendance_locks')
    .insert({ session_id: sessionId, user_id: userId })
    .select()
    .maybeSingle();

  if (lockErr) {
    // Nếu lỗi unique violation => lock đã tồn tại
    if (lockErr.code === '23505') return false;
    // Lỗi khác (table chưa tồn tại, v.v.) → fallback cho phép proceed
    const log = require('../utils/logger.js');
    log.warn('LOCK', null, 'tryAcquireL2 thất bại: %s', lockErr.message);
    return true;
  }
  return true;
}

async function _releaseL2(sessionId, userId) {
  const { error } = await getClient()
    .from('attendance_locks')
    .delete()
    .eq('session_id', sessionId)
    .eq('user_id', userId);

  if (error) {
    const log = require('../utils/logger.js');
    log.warn('LOCK', null, 'releaseL2 thất bại: %s', error.message);
  }
}

/**
 * Acquire distributed lock cho attendance.
 * L1 (in-memory) chặn nhanh click từ cùng instance.
 * L2 (DB) chặn multi-instance.
 */
async function tryAcquireAttendanceLock(sessionId, userId) {
  if (!_tryAcquireL1(sessionId, userId)) return false;
  return await _tryAcquireL2(sessionId, userId);
}

/**
 * Release lock sau khi xử lý xong (gọi trong finally block).
 */
async function releaseAttendanceLock(sessionId, userId) {
  _releaseL1(sessionId, userId);
  await _releaseL2(sessionId, userId);
}

async function upsertAttendance(payload) {
  const { data, error } = await getClient()
    .from('attendances').upsert(payload, { onConflict: 'session_id,user_id' }).select().single();
  _throwSupabase(error, 'upsertAttendance');
  addBreadcrumb('attendance', 'upsertAttendance', { userId: payload.user_id, status: payload.status });
  return data;
}

async function upsertAttendanceNoTime(sessionId, guildId, userId, username, status, markedBy) {
  const { data, error } = await getClient()
    .from('attendances')
    .upsert(
      { session_id: sessionId, guild_id: guildId, user_id: userId, username, status, marked_by: markedBy },
      { onConflict: 'session_id,user_id', ignoreDuplicates: false }
    ).select().single();
  _throwSupabase(error, 'upsertAttendanceNoTime');
  return data;
}

async function getAttendances(sessionId) {
  const { data, error } = await getClient()
    .from('attendances')
    .select('id, session_id, guild_id, user_id, username, status, marked_by, checked_in_at')
    .eq('session_id', sessionId);
  _throwSupabase(error, 'getAttendances');
  return _validateAttendances(data ?? [], 'getAttendances');
}

async function getAttendancesByUser(guildId, userId, limit = 200) {
  const { data, error } = await getClient()
    .from('attendances')
    .select('session_id, status, checked_in_at, sessions!inner(session_name, started_at, cancelled)')
    .eq('guild_id', guildId).eq('user_id', userId).eq('sessions.cancelled', false)
    .order('checked_in_at', { ascending: false }).limit(limit);
  _throwSupabase(error, 'getAttendancesByUser');
  return data ?? [];
}

async function getAttendanceStats(guildId, userId) {
  const { data, error } = await getClient()
    .from('attendances')
    .select('status, sessions!inner(cancelled)')
    .eq('guild_id', guildId).eq('user_id', userId).eq('sessions.cancelled', false);
  _throwSupabase(error, 'getAttendanceStats');
  return data ?? [];
}

async function getAllAttendances(guildId, limit = 5000) {
  const { data, error } = await getClient()
    .from('attendances')
    .select('user_id, username, status, session_id, checked_in_at, marked_by, sessions!inner(session_name, started_at, cancelled)')
    .eq('guild_id', guildId).order('checked_in_at', { ascending: false }).limit(limit);
  _throwSupabase(error, 'getAllAttendances');
  return _validateAttendances(data ?? [], 'getAllAttendances');
}

async function bulkInsertAbsent(sessionId, guildId, rows) {
  if (!rows.length) return;
  const payload = rows.map(r => ({
    session_id:  sessionId,
    guild_id:    guildId,
    user_id:     r.user_id,
    username:    r.username ?? r.user_id,
    status:      'khong_tham_gia',
    marked_by:   'system',
  }));
  const { error } = await getClient()
    .from('attendances')
    .upsert(payload, { onConflict: 'session_id,user_id', ignoreDuplicates: true });
  _throwSupabase(error, 'bulkInsertAbsent');
}

module.exports = {
  upsertAttendance, upsertAttendanceNoTime,
  getAttendances, getAttendancesByUser, getAttendanceStats, getAllAttendances,
  bulkInsertAbsent,
  tryAcquireAttendanceLock, releaseAttendanceLock,
};
