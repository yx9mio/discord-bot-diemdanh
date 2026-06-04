// services/configService.js — Guild config
'use strict';
const { getClient, _throwSupabase } = require('./_client.js');

function getGuildConfig(guildId) {
  return getClient()
    .from('guild_configs').select('*').eq('guild_id', guildId).maybeSingle()
    .then(({ data, error }) => { _throwSupabase(error, 'getGuildConfig'); return data; });
}

async function upsertGuildConfig(config) {
  const { data, error } = await getClient()
    .from('guild_configs').upsert(config, { onConflict: 'guild_id' }).select().single();
  _throwSupabase(error, 'upsertGuildConfig');
  return data;
}

function setGuildConfig(guildId, patch) {
  return upsertGuildConfig({ ...patch, guild_id: guildId });
}

async function ensureGuildConfig(guildId) {
  const { data, error } = await getClient()
    .from('guild_configs')
    .upsert({ guild_id: guildId }, { onConflict: 'guild_id', ignoreDuplicates: true })
    .select().single();
  _throwSupabase(error, 'ensureGuildConfig');
  return data;
}

const getConfig = getGuildConfig;

module.exports = { getGuildConfig, upsertGuildConfig, setGuildConfig, ensureGuildConfig, getConfig };
