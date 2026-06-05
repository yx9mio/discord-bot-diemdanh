'use strict';
// [FIX] stub — getSessions dùng bởi _HistoryView.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Lấy lịch sử phiên điểm danh của 1 guild (mới nhất trước).
 * @param {string} guildId
 * @param {number} [limit=50]
 * @returns {Promise<Array>}
 */
async function getSessions(guildId, limit = 50) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/**
 * Lấy phiên đang mở (chưa kết thúc) của 1 guild.
 * @param {string} guildId
 * @returns {Promise<object|null>}
 */
async function getActiveSession(guildId) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('guild_id', guildId)
    .is('ended_at', null)
    .eq('cancelled', false)
    .maybeSingle();
  if (error) throw error;
  return data;
}

module.exports = { getSessions, getActiveSession };
