// db/index.js — Re-export toàn bộ DB functions với getClient đã bind
// [#3] Phase B: db.js monolith đã được tách ra db/ modules
// db.js gốc vẫn là shim duy nhất để mọi require('../db.js') không cần thay đổi
'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

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

const S  = require('./sessions.js');
const A  = require('./attendance.js');
const M  = require('./members.js');
const C  = require('./config.js');
const L  = require('./locks.js');

// Bind getClient vào tất cả hàm để caller dùng như db.js cũ
const bind = (mod) => Object.fromEntries(
  Object.entries(mod).map(([k, fn]) => [k, (...args) => fn(getClient, ...args)])
);

module.exports = {
  ...bind(S),
  ...bind(A),
  ...bind(M),
  ...bind(C),
  ...bind(L),
  // Aliases giữ backward-compat
  getConfig:           (...a) => S.getActiveSession(getClient, ...a), // alias cũ
  getSessionHistory:   (...a) => S.getRecentSessions(getClient, ...a),
  getBadges:           (...a) => M.getBadgeDefinitions(getClient, ...a),
  getLichCoDinh:       (...a) => S.getScheduledSessions(getClient, ...a),
  getLichCoDinhById:   (...a) => S.getScheduledSessionById(getClient, ...a),
  createLichCoDinh:    (...a) => S.createScheduledSession(getClient, ...a),
  updateLichCoDinh:    (...a) => S.updateScheduledSession(getClient, ...a),
  deleteLichCoDinh:    (...a) => S.deleteScheduledSession(getClient, ...a),
  themLichCoDinh:      (guildId, opts) => S.createScheduledSession(getClient, {
    guild_id: guildId,
    day_of_week: opts.dayOfWeek, hour: opts.hour, minute: opts.minute,
    session_name: opts.sessionName ?? 'Điểm danh',
    close_day_of_week: opts.closeDayOfWeek ?? null,
    close_hour: opts.closeHour ?? null, close_minute: opts.closeMinute ?? null,
    phai_role_ids: opts.phaiRoleIds ?? [], allowed_role_id: opts.allowedRoleId ?? null,
    channel_id: opts.channelId, is_active: true, reminder_enabled: true,
    reminder_1_min: opts.reminder1Min ?? 30, reminder_2_min: opts.reminder2Min ?? 10,
  }),
  suaLichCoDinh: (guildId, id, opts) => S.updateScheduledSession(getClient, id, {
    day_of_week: opts.dayOfWeek, hour: opts.hour, minute: opts.minute,
    session_name: opts.sessionName,
    close_day_of_week: opts.closeDayOfWeek ?? null,
    close_hour: opts.closeHour ?? null, close_minute: opts.closeMinute ?? null,
    channel_id: opts.channelId, allowed_role_id: opts.allowedRoleId ?? null,
    reminder_1_min: opts.reminder1Min ?? undefined, reminder_2_min: opts.reminder2Min ?? undefined,
  }),
  xoaLichCoDinh: (_guildId, id) => S.deleteScheduledSession(getClient, id),
};
