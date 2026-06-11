// services/_client.js — Shared Supabase client + DB helpers
// Internal module, không export ra ngoài services/
'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const log = require('../utils/logger.js');
const { SessionSchema, AttendanceSchema, safeParse } = require('../utils/validate.js');

// Lazy-init: tránh crash trong môi trường test (Node 20 không có native WebSocket)
let _supabase = null;
function getClient() {
  if (!_supabase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      throw new Error('[DB] SUPABASE_URL hoặc SUPABASE_KEY chưa được cấu hình. Kiểm tra file .env');
    }
    _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  }
  return _supabase;
}

function _throwSupabase(error, ctx) {
  if (error) {
    log.error('DB', null, '[%s] %s', ctx, error.message);
    throw new Error(`[DB:${ctx}] ${error.message}`);
  }
}

function _validateSession(row, ctx) {
  if (!row) return null;
  const v = safeParse(SessionSchema, row);
  if (!v.ok) log.error('DB', null, '[%s] SessionSchema invalid: %s', ctx, v.error);
  return row;
}

function _validateAttendances(rows, ctx) {
  if (!Array.isArray(rows)) return [];
  for (const row of rows) {
    const v = safeParse(AttendanceSchema, row);
    if (!v.ok) log.warn('DB', null, '[%s] AttendanceSchema warn for user %s: %s', ctx, row?.user_id, v.error);
  }
  return rows;
}

// [BUG-HISTORY] public.sessions thực tế không có created_at, chỉ có started_at.
const SESSION_TIME_COLUMN = 'started_at';

module.exports = { getClient, _throwSupabase, _validateSession, _validateAttendances, SESSION_TIME_COLUMN };
