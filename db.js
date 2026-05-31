// ============================================================
// db.js — Supabase client + toàn bộ thao tác cơ sở dữ liệu
// ============================================================
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('[LỖI NGHIÊM TRỌNG] Thiếu SUPABASE_URL hoặc SUPABASE_KEY trong .env!');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ─── Helper ─────────────────────────────────────────────────────
function throwIfError(error, context) {
  if (error) {
    console.error(`[DB LỖI] ${context}:`, error.message);
    throw error;
  }
}

// ─── Cấu hình Guild ─────────────────────────────────────────────
async function getConfig(guildId) {
  const { data, error } = await supabase
    .from('guild_configs')
    .select('*')
    .eq('guild_id', guildId)
    .maybeSingle();
  throwIfError(error, 'getConfig');
  return data ?? { guild_id: guildId, allowed_role_id: null, admin_role_id: null };
}

async function setConfig(guildId, updates) {
  const existing = await getConfig(guildId);
  const { error } = await supabase
    .from('guild_configs')
    .upsert({ ...existing, ...updates, guild_id: guildId, updated_at: new Date().toISOString() });
  throwIfError(error, 'setConfig');
}

// ─── Phiên Điểm Danh ──────────────────────────────────────────────
async function getActiveSession(guildId) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('guild_id', guildId)
    .eq('is_active', true)
    .maybeSingle();
  throwIfError(error, 'getActiveSession');
  return data;
}

async function createSession(guildId, { sessionName, roleName, allowedRoleId, eligibleMemberIds, startedBy, autoCloseAt, channelId }) {
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
      channel_id: channelId ?? null,
      message_id: null,
      is_active: true,
      cancelled: false,
    })
    .select()
    .single();
  throwIfError(error, 'createSession');
  return data;
}

async function updateSessionMessageId(sessionId, messageId) {
  const { error } = await supabase
    .from('sessions')
    .update({ message_id: messageId })
    .eq('id', sessionId);
  throwIfError(error, 'updateSessionMessageId');
}

async function endSession(sessionId) {
  const { error } = await supabase
    .from('sessions')
    .update({ is_active: false, ended_at: new Date().toISOString() })
    .eq('id', sessionId);
  throwIfError(error, 'endSession');
}

// Soft-delete: đánh dấu cancelled=true thay vì xóa hẳn
async function cancelSession(sessionId) {
  const { error } = await supabase
    .from('sessions')
    .update({ is_active: false, cancelled: true, ended_at: new Date().toISOString() })
    .eq('id', sessionId);
  throwIfError(error, 'cancelSession');
}

// ─── Điểm Danh ────────────────────────────────────────────────────────
async function getAttendances(sessionId) {
  const { data, error } = await supabase
    .from('attendances')
    .select('*')
    .eq('session_id', sessionId)
    .order('checked_in_at', { ascending: true });
  throwIfError(error, 'getAttendances');
  return data ?? [];
}

async function upsertAttendance(sessionId, guildId, userId, username, status) {
  const { error } = await supabase
    .from('attendances')
    .upsert(
      { session_id: sessionId, guild_id: guildId, user_id: userId, username, status, checked_in_at: new Date().toISOString() },
      { onConflict: 'session_id,user_id' }
    );
  throwIfError(error, 'upsertAttendance');
}

async function removeAttendance(sessionId, userId) {
  const { error } = await supabase
    .from('attendances')
    .delete()
    .eq('session_id', sessionId)
    .eq('user_id', userId);
  throwIfError(error, 'removeAttendance');
}

// ─── Thống Kê Thành Viên ──────────────────────────────────────────
async function getMemberStats(guildId, userId) {
  const { data, error } = await supabase
    .from('member_stats')
    .select('*')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .maybeSingle();
  throwIfError(error, 'getMemberStats');
  return data ?? { guild_id: guildId, user_id: userId, total_sessions: 0, total_joined: 0, current_streak: 0, best_streak: 0 };
}

// Fix: streak chỉ tăng liên tiếp nếu phiên liền trước cũng đã tham gia
async function updateMemberStats(guildId, userId, joined, sessionId) {
  const existing = await getMemberStats(guildId, userId);
  const newTotal  = existing.total_sessions + 1;
  const newJoined = existing.total_joined + (joined ? 1 : 0);

  // Streak: nếu tham gia và phiên trước cũng tham gia (last_session_id có streak > 0)
  // thì tăng tiếp, ngược lại reset về 1 (không kế thừa streak cũ nếu vắng giữa chừng)
  let newStreak;
  if (!joined) {
    newStreak = 0;
  } else if (existing.current_streak > 0) {
    // Phên trước có streak — tiếp tục chuỗi
    newStreak = existing.current_streak + 1;
  } else {
    // Phên trước vắng (streak = 0) — bắt đầu chuỗi mới
    newStreak = 1;
  }

  const newBest = Math.max(existing.best_streak, newStreak);

  const { error } = await supabase
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
  throwIfError(error, 'updateMemberStats');

  return { ...existing, total_sessions: newTotal, total_joined: newJoined, current_streak: newStreak, best_streak: newBest };
}

async function getAllMemberStats(guildId) {
  const { data, error } = await supabase
    .from('member_stats')
    .select('*')
    .eq('guild_id', guildId)
    .order('total_joined', { ascending: false });
  throwIfError(error, 'getAllMemberStats');
  return data ?? [];
}

// ─── Lịch Sử Phiên ───────────────────────────────────────────────
async function getSessionHistory(guildId, limit = 20) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('guild_id', guildId)
    .eq('is_active', false)
    .eq('cancelled', false)       // Loại bỏ phiên bị hủy
    .order('ended_at', { ascending: false })
    .limit(limit);
  throwIfError(error, 'getSessionHistory');
  return data ?? [];
}

module.exports = {
  supabase,
  getConfig, setConfig,
  getActiveSession, createSession, updateSessionMessageId, endSession, cancelSession,
  getAttendances, upsertAttendance, removeAttendance,
  getMemberStats, updateMemberStats, getAllMemberStats,
  getSessionHistory,
};
