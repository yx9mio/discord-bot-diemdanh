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

async function updateScheduledSession(id, payload) {
  const { data, error } = await getClient()
    .from('scheduled_sessions').update(payload).eq('id', id).select().single();
  _throwSupabase(error, 'updateScheduledSession');
  return data;
}

async function deleteScheduledSession(id) {
  const { error } = await getClient().from('scheduled_sessions').delete().eq('id', id);
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

module.exports = {
  getScheduledSessions, getScheduledSessionById,
  createScheduledSession, updateScheduledSession, deleteScheduledSession, skipScheduledSession,
  getLichCoDinh, getLichCoDinhById,
  createLichCoDinh, updateLichCoDinh, deleteLichCoDinh,
  themLichCoDinh, suaLichCoDinh, xoaLichCoDinh,
};
