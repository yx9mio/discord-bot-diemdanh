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

async function ensureGuildConfig(guildId) {
  // [BUG-FIX] maybeSingle thay single — ignoreDuplicates upsert không trả row
  // khi row đã tồn tại → PGRST116 bị log như lỗi mỗi lần guild re-join
  const { data, error } = await getClient()
    .from('guild_configs')
    .upsert({ guild_id: guildId }, { onConflict: 'guild_id', ignoreDuplicates: true })
    .select().maybeSingle();
  _throwSupabase(error, 'ensureGuildConfig');
  return data;
}

const getConfig = getGuildConfig;

function setConfigField(guildId, field, value) {
  return upsertGuildConfig({ guild_id: guildId, [field]: value });
}

module.exports = { getGuildConfig, upsertGuildConfig, ensureGuildConfig, getConfig, setConfigField };
