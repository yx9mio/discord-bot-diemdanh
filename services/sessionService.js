// services/sessionService.js — CRUD phiên điểm danh
'use strict';
const { addBreadcrumb } = require('../utils/sentry.js');
const { getClient, _throwSupabase, _validateSession, SESSION_TIME_COLUMN } = require('./_client.js');

async function createSession(payload) {
  const row = {
    ...payload,
    guild_id:            payload.guild_id            ?? payload.guildId,
    session_name:        payload.session_name        ?? payload.sessionName,
    description:         payload.description         ?? null,
    eligible_member_ids: payload.eligible_member_ids ?? payload.eligibleMemberIds ?? [],
    phai_role_ids:       payload.phai_role_ids       ?? payload.phaiRoleIds ?? [],
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

async function getActiveSession(guildId) {
  const [sessionRes, cfgRes] = await Promise.all([
    getClient()
      .from('sessions').select('*')
      .eq('guild_id', guildId).eq('is_active', true).eq('cancelled', false)
      .maybeSingle(),
    getClient()
      .from('guild_configs').select('phai_role_icons').eq('guild_id', guildId).maybeSingle(),
  ]);
  _throwSupabase(sessionRes.error, 'getActiveSession');
  const session = _validateSession(sessionRes.data, 'getActiveSession');
  if (session) session.phai_role_icons = cfgRes?.data?.phai_role_icons ?? {};
  return session;
}

async function getActiveSessions(guildId) {
  const [sessionsRes, cfgRes] = await Promise.all([
    getClient()
      .from('sessions').select('*')
      .eq('guild_id', guildId).eq('is_active', true).eq('cancelled', false)
      .order('started_at', { ascending: false }),
    getClient()
      .from('guild_configs').select('phai_role_icons').eq('guild_id', guildId).maybeSingle(),
  ]);
  _throwSupabase(sessionsRes.error, 'getActiveSessions');
  const phaiIcons = cfgRes?.data?.phai_role_icons ?? {};
  if (!sessionsRes.data) return [];
  sessionsRes.data.forEach(row => {
    _validateSession(row, 'getActiveSessions');
    row.phai_role_icons = phaiIcons;
  });
  return sessionsRes.data;
}

async function getSessionById(sessionId) {
  const { data, error } = await getClient()
    .from('sessions').select('*').eq('id', sessionId).maybeSingle();
  _throwSupabase(error, 'getSessionById');
  const session = _validateSession(data, 'getSessionById');
  if (session) {
    const { data: cfgData } = await getClient()
      .from('guild_configs').select('phai_role_icons').eq('guild_id', session.guild_id).maybeSingle().catch(() => ({}));
    session.phai_role_icons = cfgData?.phai_role_icons ?? {};
  }
  return session;
}

async function getSessionByMessageId(messageId) {
  const { data, error } = await getClient()
    .from('sessions').select('*').eq('message_id', messageId).maybeSingle();
  _throwSupabase(error, 'getSessionByMessageId');
  return _validateSession(data, 'getSessionByMessageId');
}

async function getSessionByIdRaw(sessionId, guildId) {
  const [sessionRes, cfgRes] = await Promise.all([
    getClient()
      .from('sessions').select('*').eq('id', sessionId).eq('guild_id', guildId).maybeSingle(),
    getClient()
      .from('guild_configs').select('phai_role_icons').eq('guild_id', guildId).maybeSingle(),
  ]);
  _throwSupabase(sessionRes.error, 'getSessionByIdRaw');
  const session = _validateSession(sessionRes.data, 'getSessionByIdRaw');
  if (session) session.phai_role_icons = cfgRes?.data?.phai_role_icons ?? {};
  return session;
}

// [BUG-11] Thêm guildId param + .eq('guild_id', guildId) — ngăn IDOR close session của guild khác
async function closeSession(sessionId, guildId) {
  const q = getClient()
    .from('sessions')
    .update({ is_active: false, ended_at: new Date().toISOString() })
    .eq('id', sessionId);
  q.eq('guild_id', guildId);
  const { data, error } = await q.select().single();
  _throwSupabase(error, 'closeSession');
  addBreadcrumb('session', 'closeSession', { sessionId, guildId });
  return _validateSession(data, 'closeSession');
}

// [BUG-11] Thêm guildId param + .eq('guild_id', guildId) — ngăn IDOR cancel session của guild khác
async function cancelSession(sessionId, guildId) {
  const q = getClient()
    .from('sessions')
    .update({ is_active: false, cancelled: true, ended_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('guild_id', guildId);
  const { data, error } = await q.select().single();
  _throwSupabase(error, 'cancelSession');
  return _validateSession(data, 'cancelSession');
}

async function updateSessionMessage(sessionId, msgOrId) {
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

async function updateSessionName(sessionId, newName) {
  const { data, error } = await getClient()
    .from('sessions').update({ session_name: newName }).eq('id', sessionId).select().single();
  _throwSupabase(error, 'updateSessionName');
  return _validateSession(data, 'updateSessionName');
}

async function updateSessionEligible(sessionId, memberIds) {
  const { data, error } = await getClient()
    .from('sessions').update({ eligible_member_ids: memberIds }).eq('id', sessionId).select().single();
  _throwSupabase(error, 'updateSessionEligible');
  return _validateSession(data, 'updateSessionEligible');
}

async function getRecentSessions(guildId, limit = 10) {
  const { data, error } = await getClient()
    .from('sessions').select('*')
    .eq('guild_id', guildId).eq('cancelled', false)
    .order(SESSION_TIME_COLUMN, { ascending: false }).limit(limit);
  _throwSupabase(error, 'getRecentSessions');
  if (!data) return [];
  data.forEach(row => _validateSession(row, 'getRecentSessions'));
  return data;
}

async function getAllSessions(guildId) {
  const { data, error } = await getClient()
    .from('sessions').select('*')
    .eq('guild_id', guildId).eq('cancelled', false)
    .order(SESSION_TIME_COLUMN, { ascending: false });
  _throwSupabase(error, 'getAllSessions');
  if (!data) return [];
  data.forEach(row => _validateSession(row, 'getAllSessions'));
  return data;
}

const getSessionHistory = getRecentSessions;

module.exports = {
  createSession, getActiveSession, getActiveSessions, getSessionById, getSessionByMessageId, getSessionByIdRaw,
  closeSession, cancelSession,
  updateSessionMessage, updateSessionName, updateSessionEligible,
  getRecentSessions, getAllSessions, getSessionHistory,
};
