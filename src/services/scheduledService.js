'use strict';
// [FIX] stub — getScheduledSessions dùng bởi _ScheduleView.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Lấy danh sách lịch cố định của 1 guild.
 * @param {string} guildId
 * @returns {Promise<Array>}
 */
async function getScheduledSessions(guildId) {
  const { data, error } = await supabase
    .from('scheduled_sessions')
    .select('*')
    .eq('guild_id', guildId)
    .order('day_of_week', { ascending: true })
    .order('hour', { ascending: true })
    .order('minute', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Thêm 1 lịch cố định.
 * @param {string} guildId
 * @param {object} payload
 * @returns {Promise<object>}
 */
async function createScheduledSession(guildId, payload) {
  const { data, error } = await supabase
    .from('scheduled_sessions')
    .insert({ guild_id: guildId, ...payload })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Xóa 1 lịch cố định theo id.
 * @param {string|number} scheduleId
 * @returns {Promise<void>}
 */
async function deleteScheduledSession(scheduleId) {
  const { error } = await supabase
    .from('scheduled_sessions')
    .delete()
    .eq('id', scheduleId);
  if (error) throw error;
}

module.exports = { getScheduledSessions, createScheduledSession, deleteScheduledSession };
