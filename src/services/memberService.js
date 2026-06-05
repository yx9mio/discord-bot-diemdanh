'use strict';
// [FIX] stub — getMembers dùng bởi _MemberView.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Lấy danh sách thành viên của 1 guild.
 * @param {string} guildId
 * @returns {Promise<Array>}
 */
async function getMembers(guildId) {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('guild_id', guildId)
    .order('username', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Thêm hoặc cập nhật 1 thành viên.
 * @param {string} guildId
 * @param {string} userId
 * @param {object} patch
 * @returns {Promise<object>}
 */
async function upsertMember(guildId, userId, patch) {
  const { data, error } = await supabase
    .from('members')
    .upsert({ guild_id: guildId, user_id: userId, ...patch }, { onConflict: 'guild_id,user_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Xóa 1 thành viên.
 * @param {string} guildId
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function deleteMember(guildId, userId) {
  const { error } = await supabase
    .from('members')
    .delete()
    .eq('guild_id', guildId)
    .eq('user_id', userId);
  if (error) throw error;
}

/**
 * Reset streak của 1 thành viên (hoặc tất cả nếu userId = 'all').
 * @param {string} guildId
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function resetStreak(guildId, userId) {
  const query = supabase
    .from('members')
    .update({ streak: 0 })
    .eq('guild_id', guildId);
  if (userId !== 'all') query.eq('user_id', userId);
  const { error } = await query;
  if (error) throw error;
}

module.exports = { getMembers, upsertMember, deleteMember, resetStreak };
