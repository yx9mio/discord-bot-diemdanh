'use strict';
// [FIX] stub — getGuildConfig dùng bởi _ConfigView.js và setupCommand.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Lấy config của 1 guild. Trả về null nếu chưa có.
 * @param {string} guildId
 * @returns {Promise<object|null>}
 */
async function getGuildConfig(guildId) {
  const { data, error } = await supabase
    .from('guild_configs')
    .select('*')
    .eq('guild_id', guildId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Upsert config của 1 guild.
 * @param {string} guildId
 * @param {object} patch - các field cần cập nhật
 * @returns {Promise<object>}
 */
async function upsertGuildConfig(guildId, patch) {
  const { data, error } = await supabase
    .from('guild_configs')
    .upsert({ guild_id: guildId, ...patch }, { onConflict: 'guild_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

module.exports = { getGuildConfig, upsertGuildConfig };
