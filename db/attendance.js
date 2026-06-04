// db/attendance.js — Attendance CRUD
'use strict';
const { addBreadcrumb } = require('../utils/sentry.js');
const { AttendanceSchema, safeParse } = require('../utils/validate.js');
const log = require('../utils/logger.js');

function _throwSupabase(error, ctx) {
  if (error) {
    log.error('DB', null, '[%s] %s', ctx, error.message);
    throw new Error(`[DB:${ctx}] ${error.message}`);
  }
}

function _validateAttendances(rows, ctx) {
  if (!Array.isArray(rows)) return [];
  return rows.filter(row => {
    const v = safeParse(AttendanceSchema, row);
    if (!v.ok) log.warn('DB', null, '[%s] AttendanceSchema warn for user %s: %s', ctx, row?.user_id, v.error);
    return true;
  });
}

async function upsertAttendance(getClient, payload) {
  const { data, error } = await getClient().from('attendances')
    .upsert(payload, { onConflict: 'session_id,user_id' }).select().single();
  _throwSupabase(error, 'upsertAttendance');
  addBreadcrumb('attendance', 'upsertAttendance', { userId: payload.user_id, status: payload.status });
  return data;
}

async function upsertAttendanceNoTime(getClient, sessionId, guildId, userId, username, status, markedBy) {
  const { data, error } = await getClient().from('attendances')
    .upsert(
      { session_id: sessionId, guild_id: guildId, user_id: userId, username, status, marked_by: markedBy },
      { onConflict: 'session_id,user_id', ignoreDuplicates: false }
    ).select().single();
  _throwSupabase(error, 'upsertAttendanceNoTime');
  return data;
}

async function getAttendances(getClient, sessionId) {
  const { data, error } = await getClient().from('attendances')
    .select('user_id, username, status, marked_by, checked_in_at').eq('session_id', sessionId);
  _throwSupabase(error, 'getAttendances');
  return _validateAttendances(data ?? [], 'getAttendances');
}

async function getAttendancesByUser(getClient, guildId, userId, limit = 50) {
  const { data, error } = await getClient().from('attendances')
    .select('session_id, status, checked_in_at, sessions!inner(session_name, started_at, cancelled)')
    .eq('guild_id', guildId).eq('user_id', userId).eq('sessions.cancelled', false)
    .order('checked_in_at', { ascending: false }).limit(limit);
  _throwSupabase(error, 'getAttendancesByUser');
  return data ?? [];
}

async function getAttendanceStats(getClient, guildId, userId) {
  const { data, error } = await getClient().from('attendances')
    .select('status, sessions!inner(cancelled)')
    .eq('guild_id', guildId).eq('user_id', userId).eq('sessions.cancelled', false);
  _throwSupabase(error, 'getAttendanceStats');
  return data ?? [];
}

async function getAllAttendances(getClient, guildId, limit = 5000) {
  const { data, error } = await getClient().from('attendances')
    .select('user_id, username, status, session_id, checked_in_at, marked_by, sessions!inner(session_name, started_at, cancelled)')
    .eq('guild_id', guildId).order('checked_in_at', { ascending: false }).limit(limit);
  _throwSupabase(error, 'getAllAttendances');
  return _validateAttendances(data ?? [], 'getAllAttendances');
}

module.exports = {
  upsertAttendance, upsertAttendanceNoTime,
  getAttendances, getAttendancesByUser, getAttendanceStats, getAllAttendances,
};
