// db/config.js — Guild config & server stats
'use strict';
const log = require('../utils/logger.js');

function _throwSupabase(error, ctx) {
  if (error) {
    log.error('DB', null, '[%s] %s', ctx, error.message);
    throw new Error(`[DB:${ctx}] ${error.message}`);
  }
}

async function getGuildConfig(getClient, guildId) {
  const { data, error } = await getClient().from('guild_configs').select('*')
    .eq('guild_id', guildId).maybeSingle();
  _throwSupabase(error, 'getGuildConfig');
  return data;
}

async function upsertGuildConfig(getClient, config) {
  const { data, error } = await getClient().from('guild_configs')
    .upsert(config, { onConflict: 'guild_id' }).select().single();
  _throwSupabase(error, 'upsertGuildConfig');
  return data;
}

function setGuildConfig(getClient, guildId, patch) {
  return upsertGuildConfig(getClient, { ...patch, guild_id: guildId });
}

async function ensureGuildConfig(getClient, guildId) {
  const { data, error } = await getClient().from('guild_configs')
    .upsert({ guild_id: guildId }, { onConflict: 'guild_id', ignoreDuplicates: true }).select().single();
  _throwSupabase(error, 'ensureGuildConfig');
  return data;
}

async function getServerStats(getClient, guildId) {
  const [sessionsRes, membersRes, attRes] = await Promise.all([
    getClient().from('sessions').select('id, cancelled', { count: 'exact', head: false }).eq('guild_id', guildId).eq('cancelled', false),
    getClient().from('members').select('user_id', { count: 'exact', head: false }).eq('guild_id', guildId),
    getClient().from('attendances').select('status', { count: 'exact', head: false }).eq('guild_id', guildId),
  ]);
  _throwSupabase(sessionsRes.error, 'getServerStats.sessions');
  _throwSupabase(membersRes.error, 'getServerStats.members');
  _throwSupabase(attRes.error, 'getServerStats.attendances');
  const totalSessions = sessionsRes.count ?? (sessionsRes.data?.length ?? 0);
  const totalMembers  = membersRes.count  ?? (membersRes.data?.length  ?? 0);
  const atts          = attRes.data ?? [];
  const present       = atts.filter(a => a.status === 'tham_gia' || a.status === 'tre').length;
  return {
    total_sessions:    totalSessions,
    total_members:     totalMembers,
    total_attendances: atts.length,
    rate_present:      atts.length ? Math.round((present / atts.length) * 100) : 0,
  };
}

module.exports = {
  getGuildConfig, upsertGuildConfig, setGuildConfig,
  ensureGuildConfig, getServerStats,
};
