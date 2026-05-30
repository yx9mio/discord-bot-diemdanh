// ============================================================
// db.js — Supabase client + all DB operations
// ============================================================
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('[FATAL] Thiếu SUPABASE_URL hoặc SUPABASE_KEY trong .env!');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ─── Guild Config ─────────────────────────────────────────────
async function getConfig(guildId) {
  const { data } = await supabase
    .from('guild_configs')
    .select('*')
    .eq('guild_id', guildId)
    .maybeSingle();
  return data ?? { guild_id: guildId, allowed_role_id: null, admin_role_id: null };
}

async function setConfig(guildId, updates) {
  const existing = await getConfig(guildId);
  await supabase
    .from('guild_configs')
    .upsert({ ...existing, ...updates, guild_id: guildId, updated_at: new Date().toISOString() });
}

// ─── Sessions ─────────────────────────────────────────────────
async function getActiveSession(guildId) {
  const { data } = await supabase
    .from('sessions')
    .select('*')
    .eq('guild_id', guildId)
    .eq('is_active', true)
    .maybeSingle();
  return data;
}

async function createSession(guildId, { sessionName, roleName, allowedRoleId, eligibleMemberIds, startedBy, autoCloseAt }) {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      guild_id: guildId,
      session_name: sessionName,
      role_name: roleName ?? 'Tất cả',
      allowed_role_id: allowedRoleId ?? null,
      eligible_member_ids: eligibleMemberIds,
      started_by: startedBy,
      auto_close_at: autoCloseAt ?? null,
      is_active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function endSession(sessionId) {
  await supabase
    .from('sessions')
    .update({ is_active: false, ended_at: new Date().toISOString() })
    .eq('id', sessionId);
}

async function cancelSession(sessionId) {
  await supabase.from('sessions').delete().eq('id', sessionId);
}

// ─── Attendances ──────────────────────────────────────────────
async function getAttendances(sessionId) {
  const { data } = await supabase
    .from('attendances')
    .select('*')
    .eq('session_id', sessionId)
    .order('checked_in_at', { ascending: true });
  return data ?? [];
}

async function upsertAttendance(sessionId, guildId, userId, username, status) {
  await supabase
    .from('attendances')
    .upsert(
      { session_id: sessionId, guild_id: guildId, user_id: userId, username, status, checked_in_at: new Date().toISOString() },
      { onConflict: 'session_id,user_id' }
    );
}

async function removeAttendance(sessionId, userId) {
  await supabase
    .from('attendances')
    .delete()
    .eq('session_id', sessionId)
    .eq('user_id', userId);
}

// ─── Member Stats ─────────────────────────────────────────────
async function getMemberStats(guildId, userId) {
  const { data } = await supabase
    .from('member_stats')
    .select('*')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? { guild_id: guildId, user_id: userId, total_sessions: 0, total_joined: 0, current_streak: 0, best_streak: 0 };
}

async function updateMemberStats(guildId, userId, joined, sessionId) {
  const existing = await getMemberStats(guildId, userId);
  const newTotal = existing.total_sessions + 1;
  const newJoined = existing.total_joined + (joined ? 1 : 0);
  const newStreak = joined ? existing.current_streak + 1 : 0;
  const newBest = Math.max(existing.best_streak, newStreak);

  await supabase
    .from('member_stats')
    .upsert({
      guild_id: guildId,
      user_id: userId,
      total_sessions: newTotal,
      total_joined: newJoined,
      current_streak: newStreak,
      best_streak: newBest,
      last_session_id: sessionId,
      updated_at: new Date().toISOString(),
    });

  return { ...existing, total_sessions: newTotal, total_joined: newJoined, current_streak: newStreak, best_streak: newBest };
}

async function getAllMemberStats(guildId) {
  const { data } = await supabase
    .from('member_stats')
    .select('*')
    .eq('guild_id', guildId)
    .order('total_joined', { ascending: false });
  return data ?? [];
}

// ─── Session History ──────────────────────────────────────────
async function getSessionHistory(guildId, limit = 20) {
  const { data } = await supabase
    .from('sessions')
    .select('*')
    .eq('guild_id', guildId)
    .eq('is_active', false)
    .order('ended_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

module.exports = {
  supabase,
  getConfig, setConfig,
  getActiveSession, createSession, endSession, cancelSession,
  getAttendances, upsertAttendance, removeAttendance,
  getMemberStats, updateMemberStats, getAllMemberStats,
  getSessionHistory,
};
