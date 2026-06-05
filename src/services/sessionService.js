'use strict';
// [FIX-DB] created_at → started_at (schema thực tế của bảng sessions)
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
    .order('started_at', { ascending: false }) // [FIX-DB] created_at → started_at
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// [FIX-DB] alias — setupHistory.js gọi getAllSessions
const getAllSessions = getSessions;

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

module.exports = { getSessions, getAllSessions, getActiveSession };
