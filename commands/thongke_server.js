// commands/thongke_server.js — /thongke_server
// Phase 6: Stats toàn server cho admin
'use strict';
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { laAdmin } = require('../utils/helpers.js');
const { buildServerStatsEmbed, replyErr, replyLoading } = require('../utils/embeds.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('thongke_server')
    .setDescription('📊 Xem thống kê điểm danh toàn server (chỉ admin)')
    .addIntegerOption(opt =>
      opt.setName('so_phien')
        .setDescription('Số phiên lịch sử lấy để tính (mặc định 20, tối đa 100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(false),
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
      const limit = interaction.options.getInteger('so_phien') ?? 20;

      const [activeSession, history, allMemberStats, topMembers] = await Promise.all([
        db.getActiveSession(guild.id),
        db.getSessionHistory(guild.id, limit),
        db.getAllMemberStats(guild.id),
        db.getTopMembers(guild.id, 10),
      ]);

      // ── Tính overallPct: trung bình tỷ lệ điểm danh qua các phiên đã đóng
      let overallPct = 0;
      if (history.length > 0) {
        const sessionPcts = history.map(s => {
          const eligible = (s.eligible_member_ids ?? []).length;
          if (eligible === 0) return null;
          // attended_count không lưu trực tiếp nên dùng tổng joined từ member_stats
          // Ước tính từ eligible vs total_joined across members
          return null; // xử lý bên dưới
        }).filter(Boolean);

        // Cách chính xác hơn: dùng total_joined / total_sessions trung bình
        const validStats = allMemberStats.filter(m => m.total_sessions > 0);
        if (validStats.length > 0) {
          const sumPct = validStats.reduce((acc, m) => acc + (m.total_joined / m.total_sessions), 0);
          overallPct = Math.round((sumPct / validStats.length) * 100);
        }
      }

      const totalSessions = history.length;
      const totalMembers  = allMemberStats.length;
      const avgAttendance = totalMembers > 0
        ? Math.round(allMemberStats.reduce((s, m) => s + (m.total_joined ?? 0), 0) / totalMembers)
        : 0;

      // Gắn attended_count ước tính vào lastSession để hiển thị
      const lastSession = history[0] ?? null;
      if (lastSession) {
        // tính số người tham gia từ member_stats (best-effort)
        lastSession.attended_count = allMemberStats.filter(
          m => m.last_session_id === lastSession.id
        ).length || null;
      }

      const stats = {
        totalSessions,
        totalMembers,
        avgAttendance,
        overallPct,
        lastSession,
        activeSession,
      };

      const embed = buildServerStatsEmbed(guild, stats, topMembers);
      await interaction.editReply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      console.error('[thongke_server] Lỗi:', err);
      await interaction.editReply({
        embeds: [],
        content: '❌ Có lỗi khi lấy dữ liệu thống kê. Vui lòng thử lại.',
      });
    }
  },
};
