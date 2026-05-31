// commands/thongke_server.js — /thongke_server
// Phase 6: Stats toàn server cho admin
// Fix: overallPct tính đúng từ per-session attendance data
// Fix: avgAttendance tính theo kỳ được chọn
// Fix: migrate laAdmin → requireAdmin
'use strict';
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { buildServerStatsEmbed, replyErr, replyErrEdit } = require('../utils/embeds.js');
const { requireAdmin } = require('../utils/permissions.js');

// ─── Helper: ISO timestamp của đầu kỳ ─────────────────────────────────────────
function getStartOf(period) {
  const now = new Date();
  if (period === 'week') {
    const day  = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon  = new Date(now);
    mon.setDate(now.getDate() + diff);
    mon.setHours(0, 0, 0, 0);
    return mon.toISOString();
  }
  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).toISOString();
  }
  return null;
}

// ─── overallPct: trung bình tỷ lệ điểm danh per-session ──────────────────────
function calcOverallPct(sessions, attMap) {
  const pcts = [];
  for (const s of sessions) {
    const eligible = (s.eligible_member_ids ?? []).length;
    if (eligible === 0) continue;
    const rows    = attMap.get(s.id) ?? [];
    const present = rows.filter(r => r.status === 'tham_gia' || r.status === 'tre').length;
    pcts.push(present / eligible);
  }
  if (pcts.length === 0) return 0;
  return Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 100);
}

// ─── Enrich lastSession với attended_count chính xác ─────────────────────────
function enrichLastSession(session, attMap) {
  if (!session) return null;
  const rows    = attMap.get(session.id) ?? [];
  const present = rows.filter(r => r.status === 'tham_gia' || r.status === 'tre').length;
  return { ...session, attended_count: present };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('thongke_server')
    .setDescription('📊 Xem thống kê điểm danh toàn server (chỉ admin)')
    .addStringOption(opt =>
      opt.setName('ky')
        .setDescription('Khoảng thời gian thống kê (mặc định: tất cả)')
        .addChoices(
          { name: '📅 Tuần này',    value: 'week'  },
          { name: '🗓️ Tháng này',   value: 'month' },
          { name: '📜 Tất cả',      value: 'all'   },
        )
        .setRequired(false)
    )
    .addIntegerOption(opt =>
      opt.setName('top')
        .setDescription('Số thành viên top hiển thị (mặc định 10, tối đa 25)')
        .setMinValue(3)
        .setMaxValue(25)
        .setRequired(false)
    ),

  async execute(interaction) {
    const { guild } = interaction;
    if (!guild) return interaction.reply(replyErr('Lệnh này chỉ dùng trong server.'));

    await interaction.deferReply({ ephemeral: true });

    const { ok } = await requireAdmin(interaction, { cfgRequired: false, context: '/thongke_server' });
    if (!ok) return;

    try {
      const period   = interaction.options.getString('ky')   ?? 'all';
      const topLimit = interaction.options.getInteger('top') ?? 10;
      const since    = getStartOf(period);

      // ─ Lấy dữ liệu song song ─────────────────────────────────────────────────
      const [activeSession, history, allMemberStats] = await Promise.all([
        db.getActiveSession(guild.id),
        db.getSessionHistoryWithRange(guild.id, since, 100),
        db.getAllMemberStats(guild.id),
      ]);

      // ─ Attendance thực tế cho các phiên trong kỳ ─────────────────────────────
      const sessionIds = history.map(s => s.id);
      const attMap     = sessionIds.length > 0
        ? await db.getAttendanceSummaryForSessions(sessionIds)
        : new Map();

      // ─ Tính các chỉ số ────────────────────────────────────────────────────────
      const overallPct    = calcOverallPct(history, attMap);
      const totalSessions = history.length;
      const totalMembers  = allMemberStats.length;

      // Top theo kỳ được chọn
      let topMembers;
      if (period === 'all') {
        topMembers = [...allMemberStats]
          .sort((a, b) => b.total_joined - a.total_joined)
          .slice(0, topLimit);
      } else {
        // Tính lại từ per-session data trong kỳ
        const userJoinMap  = new Map();
        const userTotalMap = new Map();
        for (const s of history) {
          for (const uid of (s.eligible_member_ids ?? [])) {
            userTotalMap.set(uid, (userTotalMap.get(uid) ?? 0) + 1);
          }
          for (const r of (attMap.get(s.id) ?? [])) {
            if (r.status === 'tham_gia' || r.status === 'tre') {
              userJoinMap.set(r.user_id, (userJoinMap.get(r.user_id) ?? 0) + 1);
            }
          }
        }
        topMembers = [...userJoinMap.entries()]
          .map(([user_id, total_joined]) => ({
            user_id,
            total_joined,
            total_sessions: userTotalMap.get(user_id) ?? 0,
          }))
          .sort((a, b) => b.total_joined - a.total_joined)
          .slice(0, topLimit);
      }

      // avgAttendance: phù hợp với kỳ được chọn
      const avgAttendance = topMembers.length > 0
        ? Math.round(topMembers.reduce((s, m) => s + (m.total_joined ?? 0), 0) / topMembers.length)
        : 0;

      const lastSession  = enrichLastSession(history[0] ?? null, attMap);
      const periodLabel  = { week: 'Tuần này', month: 'Tháng này', all: 'Tất cả' }[period];

      const stats = {
        totalSessions, totalMembers, avgAttendance,
        overallPct, lastSession, activeSession, periodLabel,
      };

      const embed = buildServerStatsEmbed(guild, stats, topMembers, topLimit);
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[thongke_server] Lỗi:', err);
      await interaction.editReply(replyErrEdit('Có lỗi khi lấy dữ liệu thống kê. Vui lòng thử lại.'));
    }
  },
};
