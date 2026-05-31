// commands/thong_ke.js — Stats cá nhân (progress bar) + top 10
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db.js');
const { layHuyHieu } = require('../utils/helpers.js');
const { buildProgressBar } = require('../utils/progress.js');
const { pctColor, pctEmoji, COLOR_GOLD, FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('../utils/embeds.js');

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('thong_ke')
    .setDescription('Xem thống kê điểm danh cá nhân và top 10 server')
    .addUserOption(o =>
      o.setName('thanh_vien')
        .setDescription('Thành viên cần xem (mặc định: bạn)')
        .setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild, user } = interaction;

    const targetUser = interaction.options.getUser('thanh_vien') ?? user;
    const targetMem  = await guild.members.fetch(targetUser.id).catch(() => null);
    const displayName = targetMem?.nickname ?? targetUser.globalName ?? targetUser.username;

    // ── Embed 1: Stats cá nhân ──────────────────────────────────
    const stats = await db.getMemberStats(guild.id, targetUser.id).catch(() => null);
    const totalJoined   = stats?.total_joined   ?? 0;
    const totalSessions = stats?.total_sessions ?? 0;
    const pct   = totalSessions > 0 ? Math.round((totalJoined / totalSessions) * 100) : 0;
    const bar   = buildProgressBar(pct);
    const badge = layHuyHieu(totalJoined);

    // Next badge target
    const { MOC_HUY_HIEU } = require('../utils/helpers.js');
    const nextMoc = MOC_HUY_HIEU.find(m => m.count > totalJoined);
    const nextTarget = nextMoc
      ? `\n🎯 *Còn ${nextMoc.count - totalJoined} lần nữa → **${nextMoc.badge} ${nextMoc.label}***`
      : '\n👑 *Đã đạt huy hiệu cao nhất!*';

    const personalEmbed = new EmbedBuilder()
      .setAuthor(AUTHOR_DEFAULT)
      .setTitle(`📊 Thống Kê: ${displayName}`)
      .setColor(pctColor(pct))
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setDescription([
        `${pctEmoji(pct)} \`${bar}\` **${pct}%** tổng thể`,
        '',
        `✅ **Tham gia:** ${totalJoined}/${totalSessions} phiên`,
        `🔥 **Streak hiện tại:** ${stats?.current_streak ?? 0} phiên liên tiếp`,
        `🏆 **Streak tốt nhất:** ${stats?.best_streak ?? 0} phiên`,
        `🏅 **Huy hiệu:** ${badge || '*(chưa có)*'}`,
        nextTarget,
      ].join('\n'))
      .setFooter({ text: `${FOOTER_DEFAULT} · Dữ liệu cập nhật theo thời gian thực` })
      .setTimestamp();

    // ── Embed 2: Top 10 ────────────────────────────────────────
    const rows = await db.getTopMembers(guild.id, 10);
    const leaderLines = await Promise.all(rows.map(async (row, i) => {
      let name = row.display_name ?? `<@${row.user_id}>`;
      try {
        const m = await guild.members.fetch(row.user_id).catch(() => null);
        if (m) name = m.nickname ?? m.user.globalName ?? m.user.username;
      } catch (_) { /* silent */ }

      const rPct   = row.total_sessions > 0 ? Math.round((row.total_joined / row.total_sessions) * 100) : 0;
      const rBar   = buildProgressBar(rPct, 8);
      const medal  = RANK_MEDALS[i] ?? `\`${String(i + 1).padStart(2)}.\``;
      const you    = row.user_id === targetUser.id ? ' ◀' : '';
      return `${medal} **${name}**${you}\n> \`${rBar}\` **${rPct}%** (${row.total_joined}/${row.total_sessions}) · 🔥${row.current_streak}`;
    }));

    const leaderEmbed = new EmbedBuilder()
      .setAuthor(AUTHOR_DEFAULT)
      .setTitle('🏆 Top 10 Thành Viên Chuyên Cần')
      .setColor(COLOR_GOLD)
      .setDescription(leaderLines.length > 0 ? leaderLines.join('\n\n') : '*(Chưa có dữ liệu)*')
      .setFooter({ text: `${FOOTER_DEFAULT} · ◀ = thành viên đang xem` })
      .setTimestamp();

    return interaction.editReply({ embeds: [personalEmbed, leaderEmbed] });
  },
};
