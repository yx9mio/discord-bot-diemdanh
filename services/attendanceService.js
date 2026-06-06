// services/attendanceService.js — Data access cho điểm danh
'use strict';
const crypto = require('crypto');
const { addBreadcrumb } = require('../utils/sentry.js');
const { getClient, _throwSupabase, _validateAttendances } = require('./_client.js');

function _hashString(str) {
  const hash = crypto.createHash('md5').update(str).digest();
  return hash.readUInt32BE(0);
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
    .select('user_id, username, status, marked_by, checked_in_at')
    .eq('session_id', sessionId);
  _throwSupabase(error, 'getAttendances');
  return _validateAttendances(data ?? [], 'getAttendances');
}

async function getAttendancesByUser(guildId, userId, limit = 50) {
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

/**
 * [BUG-FIX] Bulk insert khong_tham_gia cho eligible members chưa có record.
 * Dùng ignoreDuplicates=true → safe nếu user đã điểm danh rồi (không ghi đè).
 *
 * @param {string} sessionId
 * @param {string} guildId
 * @param {Array<{user_id: string, username: string}>} rows
 */
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
  upsertAttendance, upsertAttendanceNoTime,
  getAttendances, getAttendancesByUser, getAttendanceStats, getAllAttendances,
  bulkInsertAbsent,
  tryAcquireAttendanceLock, releaseAttendanceLock,
};
