// services/scheduledService.js — Lịch cố định (scheduled sessions)
'use strict';
const { getClient, _throwSupabase } = require('./_client.js');

async function getScheduledSessions(guildId) {
  const { data, error } = await getClient()
    .from('scheduled_sessions').select('*').eq('guild_id', guildId).eq('is_active', true);
  _throwSupabase(error, 'getScheduledSessions');
  return data ?? [];
}

async function getScheduledSessionById(id) {
  const { data, error } = await getClient()
    .from('scheduled_sessions').select('*').eq('id', id).maybeSingle();
  _throwSupabase(error, 'getScheduledSessionById');
  return data;
}

async function createScheduledSession(payload) {
  const { data, error } = await getClient()
    .from('scheduled_sessions').insert(payload).select().single();
  _throwSupabase(error, 'createScheduledSession');
  return data;
}

async function updateScheduledSession(guildId, id, payload) {
  const { data, error } = await getClient()
    .from('scheduled_sessions').update(payload).eq('id', id).eq('guild_id', guildId).select().single();
  _throwSupabase(error, 'updateScheduledSession');
  return data;
}

async function deleteScheduledSession(guildId, id) {
  const { error } = await getClient().from('scheduled_sessions').delete().eq('id', id).eq('guild_id', guildId);
  _throwSupabase(error, 'deleteScheduledSession');
}

async function skipScheduledSession(id, skipUntil) {
  const { data, error } = await getClient()
    .from('scheduled_sessions').update({ skip_until: skipUntil }).eq('id', id).select().single();
  _throwSupabase(error, 'skipScheduledSession');
  return data;
}

// Vietnamese aliases
const getLichCoDinh     = getScheduledSessions;
const getLichCoDinhById = getScheduledSessionById;
const createLichCoDinh  = createScheduledSession;
const updateLichCoDinh  = updateScheduledSession;
const deleteLichCoDinh  = deleteScheduledSession;

// [FIX-DB] Không có cột pre_close_minutes — dùng close_hour/close_minute + reminder_1_min/reminder_2_min
function themLichCoDinh(guildId, { dayOfWeek, hour, minute, sessionName, closeDayOfWeek, closeHour, closeMinute, phaiRoleIds, channelId, allowedRoleId, reminder1Min, reminder2Min }) {
  return createScheduledSession({
    guild_id:          guildId,
    day_of_week:       dayOfWeek,
    hour,
    minute,
    session_name:      sessionName ?? 'Điểm danh',
    close_day_of_week: closeDayOfWeek ?? null,
    close_hour:        closeHour ?? null,
    close_minute:      closeMinute ?? null,
    phai_role_ids:     phaiRoleIds ?? [],
    allowed_role_id:   allowedRoleId ?? null,
    channel_id:        channelId,
    is_active:         true,
    reminder_enabled:  true,
    reminder_1_min:    reminder1Min ?? 30,
    reminder_2_min:    reminder2Min ?? 10,
  });
}

function suaLichCoDinh(guildId, id, { dayOfWeek, hour, minute, sessionName, closeDayOfWeek, closeHour, closeMinute, channelId, allowedRoleId, reminder1Min, reminder2Min }) {
  return updateScheduledSession(guildId, id, {
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

function xoaLichCoDinh(guildId, id) {
  return deleteScheduledSession(guildId, id);
}

// Wrappers to match caller expectations

const getActiveSchedules = getScheduledSessions;

async function getDueReminders(now) {
  const { data, error } = await getClient()
    .from('reminders').select('*').lte('due_at', now.toISOString());
  _throwSupabase(error, 'getDueReminders');
  return data ?? [];
}

async function markReminderSent(id) {
  const { error } = await getClient()
    .from('reminders').update({ sent_at: new Date().toISOString() }).eq('id', id);
  _throwSupabase(error, 'markReminderSent');
}

function addRecurringSession(guildId, { thu, gio_bat_dau, close_day_of_week, close_hour, close_minute, ten, timezone, pre_close_minutes, channel_id }) {
  const [hour, minute] = gio_bat_dau.split(':').map(Number);
  return createScheduledSession({
    guild_id:          guildId,
    day_of_week:       thu,
    hour,
    minute,
    session_name:      ten || 'Điểm danh',
    close_day_of_week: close_day_of_week ?? null,
    close_hour:        close_hour ?? null,
    close_minute:      close_minute ?? null,
    phai_role_ids:     [],
    allowed_role_id:   null,
    channel_id:        channel_id ?? null,
    is_active:         true,
    reminder_enabled:  true,
    pre_close_minutes: pre_close_minutes ?? 30,
    reminder_1_min:    pre_close_minutes ?? 30,
    reminder_2_min:    10,
    type:              'recurring_weekly',
  });
}

function addOnetimeSession(guildId, { ngay, gio_bat_dau, gio_ket_thuc, ten, timezone, pre_close_minutes }) {
  const [hour, minute] = gio_bat_dau.split(':').map(Number);
  let closeHour = null, closeMinute = null;
  if (gio_ket_thuc) {
    const [ch, cm] = gio_ket_thuc.split(':').map(Number);
    closeHour = ch;
    closeMinute = cm;
  }
  const [yyyy, mm, dd] = ngay.includes('-') ? ngay.split('-').map(Number) : ngay.split('/').reverse().map(Number);
  return createScheduledSession({
    guild_id:          guildId,
    hour,
    minute,
    session_name:      ten || 'Điểm danh',
    scheduled_date:    `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`,
    close_hour:        closeHour,
    close_minute:      closeMinute,
    phai_role_ids:     [],
    allowed_role_id:   null,
    channel_id:        null,
    is_active:         true,
    reminder_enabled:  true,
    pre_close_minutes: pre_close_minutes ?? 30,
    reminder_1_min:    pre_close_minutes ?? 30,
    reminder_2_min:    10,
    type:              'one_time',
  });
}

module.exports = {
  getScheduledSessions, getScheduledSessionById,
  createScheduledSession, updateScheduledSession, deleteScheduledSession, skipScheduledSession,
  getLichCoDinh, getLichCoDinhById,
  createLichCoDinh, updateLichCoDinh, deleteLichCoDinh,
  themLichCoDinh, suaLichCoDinh, xoaLichCoDinh,
  getActiveSchedules, getDueReminders, markReminderSent,
  addRecurringSession, addOnetimeSession,
};
