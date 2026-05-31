// commands/thongke_server.js — /thongke_server
// Phase 6: Stats toàn server cho admin
// Fix: overallPct tính đúng từ per-session attendance data
// New: time filter tuần/tháng/tất cả
'use strict';
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { laAdmin } = require('../utils/helpers.js');
const { buildServerStatsEmbed, replyErr, replyErrEdit } = require('../utils/embeds.js');

// ─── Helper: ISO timestamp của đầu kỳ ─────────────────────────────────────────
function getStartOf(period) {
  const now = new Date();
  if (period === 'week') {
    // Đầu tuần (Thứ 2)
    const day = now.getDay(); // 0=CN, 1=T2...
    const diff = (day === 0 ? -6 : 1 - day);
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString();
  }
  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).toISOString();
  }
  return null; // 'all'
}

// ─── Helper: Tính overallPct chính xác từ per-session data ─────────────────────
// Logic: với mỗi phiên, tính (số thạm gia + trễ) / eligible * 100.
// overallPct = trung bình số học các phiên đó.
function calcOverallPct(sessions, attMap) {
  const pcts = [];
  for (const s of sessions) {
    const eligible = (s.eligible_member_ids ?? []).length;
    if (eligible === 0) continue;
    const rows = attMap.get(s.id) ?? [];
    const present = rows.filter(r => r.status === 'tham_gia' || r.status === 'tre').length;
    pcts.push(present / eligible);
  }
  if (pcts.length === 0) return 0;
  return Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 100);
}

// ─── Helper: Tính lastSession attended_count chính xác từ attMap ─────────
function enrichLastSession(session, attMap) {
  if (!session) return null;
  const rows = attMap.get(session.id) ?? [];
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
    const { guild, member } = interaction;
    if (!guild) return interaction.reply(replyErr('Lệnh này chỉ dùng trong server.'));

    const cfg = await db.getConfig(guild.id);
    if (!laAdmin(member, cfg)) {
      return interaction.reply(replyErr('🔒 Chỉ admin mới dùng được lệnh này.'));
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const period   = interaction.options.getString('ky')   ?? 'all';
      const topLimit = interaction.options.getInteger('top') ?? 10;
      const since    = getStartOf(period);

      // ─ Lấy dữ liệu song song ──────────────────────────────────────
      const [activeSession, history, allMemberStats] = await Promise.all([
        db.getActiveSession(guild.id),
        db.getSessionHistoryWithRange(guild.id, since, 100),
        db.getAllMemberStats(guild.id),
      ]);

      // ─ Lấy attendance thực tế cho các phiên trong kỳ ───────────────────
      const sessionIds = history.map(s => s.id);
      const attMap     = await db.getAttendanceSummaryForSessions(sessionIds);

      // ─ Tính các chỉ số ──────────────────────────────────────────────────
      const overallPct    = calcOverallPct(history, attMap);
      const totalSessions = history.length;

      // Top theo kỳ được chọn: tính lại từ attMap nếu có filter, dùng allMemberStats nếu all
      let topMembers;
      if (period === 'all') {
        // Dùng member_stats có sẵn (aggregate toàn bộ)
        topMembers = [...allMemberStats]
          .sort((a, b) => b.total_joined - a.total_joined)
          .slice(0, topLimit);
      } else {
        // Tính lại từ per-session data trong kỳ
        const userJoinMap = new Map();
        const userTotalMap = new Map();
        for (const s of history) {
          const eligible = s.eligible_member_ids ?? [];
          for (const uid of eligible) {
            userTotalMap.set(uid, (userTotalMap.get(uid) ?? 0) + 1);
          }
          const rows = attMap.get(s.id) ?? [];
          for (const r of rows) {
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

      // Tổng thành viên theo dõi (dùng allMemberStats toàn bộ dù kỳ nào)
      const totalMembers  = allMemberStats.length;
      const avgAttendance = totalMembers > 0
        ? Math.round(allMemberStats.reduce((s, m) => s + (m.total_joined ?? 0), 0) / totalMembers)
        : 0;

      // lastSession với attended_count chính xác
      const lastSession = enrichLastSession(history[0] ?? null, attMap);

      const periodLabel = { week: 'Tuần này', month: 'Tháng này', all: 'Tất cả' }[period];

      const stats = {
        totalSessions,
        totalMembers,
        avgAttendance,
        overallPct,
        lastSession,
        activeSession,
        periodLabel,
      };

      const embed = buildServerStatsEmbed(guild, stats, topMembers);
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[thongke_server] Lỗi:', err);
      await interaction.editReply(
        replyErrEdit('Có lỗi khi lấy dữ liệu thống kê. Vui lòng thử lại.')
      );
    }
  },
};
