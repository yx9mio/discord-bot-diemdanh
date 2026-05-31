// handlers/userPanelHandler.js — Panel thống kê cá nhân cho /toi
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const db = require('../db.js');

const STATUS_ICON = {
  tham_gia:       '✅',
  tre:            '⏰',
  khong_tham_gia: '❌',
};

const DAYS_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function formatDate(dateStr) {
  if (!dateStr) return '?';
  const d = new Date(dateStr);
  const day = DAYS_VI[d.getDay()];
  return `${day} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function rankEmoji(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

async function buildUserPanel(guild, member, userId) {
  const stats    = await db.getMemberStats(guild.id, userId);
  const topList  = await db.getTopMembers(guild.id, 100);
  const history  = await db.getSessionHistory(guild.id, 10);
  const active   = await db.getActiveSession(guild.id);

  // Tính rank
  const rankIndex = topList.findIndex(m => m.user_id === userId);
  const rank      = rankIndex >= 0 ? rankIndex + 1 : null;
  const totalMembers = topList.length;

  // Tỉ lệ tham gia
  const pct = stats.total_sessions > 0
    ? Math.round((stats.total_joined / stats.total_sessions) * 100)
    : 0;

  // Lịch sử 5 phiên gần nhất mà user là eligible
  const recentSessions = history
    .filter(s => s.eligible_member_ids?.includes(userId))
    .slice(0, 5);

  // Lấy attendance của các phiên đó (song song)
  const attResults = await Promise.all(
    recentSessions.map(s => db.getAttendances(s.id))
  );

  const historyLines = recentSessions.map((s, i) => {
    const atts   = attResults[i];
    const myAtt  = atts.find(a => a.user_id === userId);
    const icon   = myAtt ? (STATUS_ICON[myAtt.status] ?? '❔') : '❌';
    const label  = s.session_name ?? 'Phiên điểm danh';
    const date   = formatDate(s.ended_at ?? s.created_at);
    return `${icon} ${label} — ${date}`;
  });

  // Embed
  const displayName = member.nickname ?? member.user.globalName ?? member.user.username;
  const avatarUrl   = member.user.displayAvatarURL({ size: 64 });

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({ name: `Thống kê của ${displayName}`, iconURL: avatarUrl })
    .setDescription('\u200b')
    .addFields(
      {
        name: '📊 Tổng quan',
        value: [
          `> Tham gia: **${stats.total_joined}** / **${stats.total_sessions}** phiên  (${pct}%)`,
          `> 🔥 Streak hiện tại: **${stats.current_streak}**  |  🏆 Best: **${stats.best_streak}**`,
          rank
            ? `> ${rankEmoji(rank)} Xếp hạng: **${rank}** / ${totalMembers} thành viên`
            : '> 📭 Chưa có dữ liệu xếp hạng',
        ].join('\n'),
        inline: false,
      },
      {
        name: active ? `📋 Phiên đang mở — ${active.session_name ?? 'Điểm danh'}` : '📋 Phiên hiện tại',
        value: active
          ? (() => {
              const myAtt = null; // active session — chưa kết thúc, không query history
              return '> ✅ Có phiên đang mở. Hãy điểm danh nếu chưa!';
            })()
          : '> Không có phiên nào đang mở.',
        inline: false,
      },
      {
        name: '📅 Lịch sử gần nhất',
        value: historyLines.length
          ? historyLines.join('\n')
          : '> Chưa có dữ liệu phiên nào.',
        inline: false,
      }
    )
    .setFooter({ text: 'Cập nhật theo thời gian thực' })
    .setTimestamp();

  // Buttons
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('toi:refresh')
      .setLabel('🔄 Làm mới')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('toi:rank')
      .setLabel('📊 Bảng xếp hạng')
      .setStyle(ButtonStyle.Primary),
  );

  return { embeds: [embed], components: [row] };
}

async function buildRankPanel(guild) {
  const topList = await db.getTopMembers(guild.id, 10);

  const lines = topList.map((m, i) => {
    const pct = m.total_sessions > 0
      ? Math.round((m.total_joined / m.total_sessions) * 100)
      : 0;
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    return `${medal} <@${m.user_id}> — **${m.total_joined}** lần (${pct}%)  🔥${m.current_streak}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('🏆 Bảng xếp hạng điểm danh')
    .setDescription(lines.length ? lines.join('\n') : 'Chưa có dữ liệu.')
    .setFooter({ text: `Top ${topList.length} thành viên tích cực nhất` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('toi:rank')
      .setLabel('🔄 Làm mới')
      .setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row] };
}

async function handleUserPanelButton(interaction) {
  const { customId, guild, member, user } = interaction;

  if (customId === 'toi:refresh') {
    await interaction.deferUpdate();
    const panel = await buildUserPanel(guild, member, user.id);
    return interaction.editReply(panel);
  }

  if (customId === 'toi:rank') {
    await interaction.deferReply({ ephemeral: true });
    const panel = await buildRankPanel(guild);
    return interaction.editReply(panel);
  }
}

module.exports = { buildUserPanel, buildRankPanel, handleUserPanelButton };
