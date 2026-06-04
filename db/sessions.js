// db/sessions.js — Session & scheduled session CRUD
'use strict';
const { addBreadcrumb } = require('../utils/sentry.js');
const { SessionSchema, safeParse } = require('../utils/validate.js');
const log = require('../utils/logger.js');

// [BUG-HISTORY] started_at là cột thời gian chuẩn (không có created_at)
const SESSION_TIME_COLUMN = 'started_at';

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

async function createSession(getClient, payload) {
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
  const { data, error } = await getClient().from('sessions').insert(row).select().single();
  _throwSupabase(error, 'createSession');
  addBreadcrumb('session', 'createSession', { guildId: row.guild_id, sessionName: row.session_name });
  return _validateSession(data, 'createSession');
}

async function getActiveSession(getClient, guildId) {
  const { data, error } = await getClient().from('sessions').select('*')
    .eq('guild_id', guildId).eq('is_active', true).eq('cancelled', false).maybeSingle();
  _throwSupabase(error, 'getActiveSession');
  return _validateSession(data, 'getActiveSession');
}

async function getSessionById(getClient, sessionId) {
  const { data, error } = await getClient().from('sessions').select('*').eq('id', sessionId).maybeSingle();
  _throwSupabase(error, 'getSessionById');
  return _validateSession(data, 'getSessionById');
}

async function getSessionByMessageId(getClient, messageId) {
  const { data, error } = await getClient().from('sessions').select('*').eq('message_id', messageId).maybeSingle();
  _throwSupabase(error, 'getSessionByMessageId');
  return _validateSession(data, 'getSessionByMessageId');
}

async function closeSession(getClient, sessionId) {
  const { data, error } = await getClient().from('sessions')
    .update({ is_active: false, ended_at: new Date().toISOString() })
    .eq('id', sessionId).select().single();
  _throwSupabase(error, 'closeSession');
  addBreadcrumb('session', 'closeSession', { sessionId });
  return _validateSession(data, 'closeSession');
}

async function cancelSession(getClient, sessionId) {
  const { data, error } = await getClient().from('sessions')
    .update({ is_active: false, cancelled: true, ended_at: new Date().toISOString() })
    .eq('id', sessionId).select().single();
  _throwSupabase(error, 'cancelSession');
  return _validateSession(data, 'cancelSession');
}

async function updateSessionMessage(getClient, sessionId, msgOrId) {
  const update = typeof msgOrId === 'string' || typeof msgOrId === 'number'
    ? { message_id: String(msgOrId) }
    : {
        ...(msgOrId.messageId  ? { message_id: String(msgOrId.messageId)  } : {}),
        ...(msgOrId.message_id ? { message_id: String(msgOrId.message_id) } : {}),
        ...(msgOrId.channelId  ? { channel_id: String(msgOrId.channelId)  } : {}),
        ...(msgOrId.channel_id ? { channel_id: String(msgOrId.channel_id) } : {}),
      };
  if (!Object.keys(update).length) return;
  const { error } = await getClient().from('sessions').update(update).eq('id', sessionId);
  _throwSupabase(error, 'updateSessionMessage');
}

async function updateSessionName(getClient, sessionId, newName) {
  const { data, error } = await getClient().from('sessions')
    .update({ session_name: newName }).eq('id', sessionId).select().single();
  _throwSupabase(error, 'updateSessionName');
  return _validateSession(data, 'updateSessionName');
}

async function updateSessionEligible(getClient, sessionId, memberIds) {
  const { data, error } = await getClient().from('sessions')
    .update({ eligible_member_ids: memberIds }).eq('id', sessionId).select().single();
  _throwSupabase(error, 'updateSessionEligible');
  return _validateSession(data, 'updateSessionEligible');
}

async function getRecentSessions(getClient, guildId, limit = 10) {
  const { data, error } = await getClient().from('sessions').select('*')
    .eq('guild_id', guildId).eq('cancelled', false)
    .order(SESSION_TIME_COLUMN, { ascending: false }).limit(limit);
  _throwSupabase(error, 'getRecentSessions');
  if (!data) return [];
  data.forEach(row => _validateSession(row, 'getRecentSessions'));
  return data;
}

async function getAllSessions(getClient, guildId) {
  const { data, error } = await getClient().from('sessions').select('*')
    .eq('guild_id', guildId).eq('cancelled', false)
    .order(SESSION_TIME_COLUMN, { ascending: false });
  _throwSupabase(error, 'getAllSessions');
  if (!data) return [];
  data.forEach(row => _validateSession(row, 'getAllSessions'));
  return data;
}

async function getSessionByIdRaw(getClient, sessionId, guildId) {
  const { data, error } = await getClient().from('sessions').select('*')
    .eq('id', sessionId).eq('guild_id', guildId).maybeSingle();
  _throwSupabase(error, 'getSessionByIdRaw');
  return _validateSession(data, 'getSessionByIdRaw');
}

// ─── Scheduled sessions ───────────────────────────────────────────────────────
async function getScheduledSessions(getClient, guildId) {
  const { data, error } = await getClient().from('scheduled_sessions').select('*')
    .eq('guild_id', guildId).eq('is_active', true);
  _throwSupabase(error, 'getScheduledSessions');
  return data ?? [];
}

async function getScheduledSessionById(getClient, id) {
  const { data, error } = await getClient().from('scheduled_sessions').select('*').eq('id', id).maybeSingle();
  _throwSupabase(error, 'getScheduledSessionById');
  return data;
}

async function createScheduledSession(getClient, payload) {
  const { data, error } = await getClient().from('scheduled_sessions').insert(payload).select().single();
  _throwSupabase(error, 'createScheduledSession');
  return data;
}

async function updateScheduledSession(getClient, id, payload) {
  const { data, error } = await getClient().from('scheduled_sessions').update(payload).eq('id', id).select().single();
  _throwSupabase(error, 'updateScheduledSession');
  return data;
}

async function deleteScheduledSession(getClient, id) {
  const { error } = await getClient().from('scheduled_sessions').delete().eq('id', id);
  _throwSupabase(error, 'deleteScheduledSession');
}

async function skipScheduledSession(getClient, id, skipUntil) {
  const { data, error } = await getClient().from('scheduled_sessions')
    .update({ skip_until: skipUntil }).eq('id', id).select().single();
  _throwSupabase(error, 'skipScheduledSession');
  return data;
}

module.exports = {
  createSession, getActiveSession, getSessionById, getSessionByMessageId,
  closeSession, cancelSession,
  updateSessionMessage, updateSessionName, updateSessionEligible,
  getRecentSessions, getAllSessions, getSessionByIdRaw,
  getScheduledSessions, getScheduledSessionById,
  createScheduledSession, updateScheduledSession,
  deleteScheduledSession, skipScheduledSession,
};
