'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, ICONS } = require('../../../utils/theme.js');
const { FOOTER_DEFAULT, buildRichProgressBar, pctEmoji, pctLabel } = require('../../../utils/embeds.js');
const { fmtTs } = require('../../../utils/format.js');

const CUSTOM_ID = {
  TOI:      'setup:stats:toi',
  RANK:     'setup:stats:rank',
  LICHSU:   'setup:stats:lichsu',
  XEM:      'setup:stats:xem',
  SERVER:   'setup:stats:server',
  BACK_HOME: 'setup:home',
};

const BADGE_THRESHOLDS = [
  { threshold: 100, label: 'Vua Điểm Danh',   emoji: '👑' },
  { threshold: 50,  label: 'Huyền Thoại',     emoji: '🏆' },
  { threshold: 30,  label: 'Kiên Trì',        emoji: '🥇' },
  { threshold: 20,  label: 'Chuyên Cần',      emoji: '🥈' },
  { threshold: 10,  label: 'Cần Cù',          emoji: '🥉' },
  { threshold: 5,   label: 'Lính Mới',        emoji: '⭐' },
];

function renderStatsMenu() {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`${ICONS.CHART} Thống kê`)
    .setDescription('Chọn một mục bên dưới để xem thống kê.')
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.TOI)
      .setLabel('Của tôi')
      .setEmoji('👤')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.RANK)
      .setLabel('Xếp hạng')
      .setEmoji('🏆')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.LICHSU)
      .setLabel('Lịch sử')
      .setEmoji('📋')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.XEM)
      .setLabel('Xem người khác')
      .setEmoji('🔍')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.SERVER)
      .setLabel('Server')
      .setEmoji('📊')
      .setStyle(ButtonStyle.Secondary),
  );

  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.BACK_HOME)
      .setLabel('← Về Bảng điều khiển')
      .setEmoji(ICONS.HOME)
      .setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row, backRow] };
}

function renderToi(stats, member, guild, badges) {
  const joined = stats?.total_joined ?? 0;
  const streak = stats?.current_streak ?? 0;
  const best   = stats?.best_streak ?? 0;
  const phong  = stats?.phong_ban ?? '';
  const name   = member?.displayName ?? member?.user?.username ?? 'Thành viên';

  const badgeStr = (badges ?? []).length
    ? (badges ?? []).map(b => {
        const t = BADGE_THRESHOLDS.find(bt => bt.threshold === b.threshold);
        return t ? `${t.emoji} **${t.label}**` : `🎖️ ${b.threshold}`;
      }).join('\n')
    : 'Chưa có huy hiệu';

  const embed = new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle(`👤 ${name}`)
    .setDescription(phong ? `📌 ${phong}` : null)
    .addFields(
      // [FIX] ICONS.ATTEND_YES không tồn tại → dùng ICONS.CHECK
      { name: `${ICONS.CHECK} Đã tham gia`, value: `**${joined}** phiên`, inline: true },
      // [FIX] ICONS.FIRE tồn tại trong theme.js — giữ nguyên
      { name: `${ICONS.FIRE} Streak hiện tại`, value: `**${streak}**`, inline: true },
      { name: '🏆 Streak cao nhất', value: `**${best}**`, inline: true },
      // [FIX] ICONS.STAR tồn tại trong theme.js — giữ nguyên
      { name: `${ICONS.STAR} Huy hiệu`, value: badgeStr, inline: false },
    )
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  if (typeof member?.displayAvatarURL === 'function') {
    const url = member.displayAvatarURL({ dynamic: true, size: 64 });
    if (url) embed.setThumbnail(url);
  }

  return { embeds: [embed], components: [], flags: undefined };
}

function renderRank(rows, guild, topN = 10) {
  const medals = ['🥇', '🥈', '🥉'];
  if (!rows?.length) {
    return {
      embeds: [new EmbedBuilder()
        // [FIX] COLORS.PURPLE không tồn tại → dùng COLORS.ACCENT
        .setColor(COLORS.ACCENT)
        .setTitle('🏆 Bảng xếp hạng')
        .setDescription('_Chưa có dữ liệu xếp hạng._')
        .setFooter({ text: FOOTER_DEFAULT })
        .setTimestamp()],
      components: [],
    };
  }
  const lines = rows.slice(0, topN).map((r, i) => {
    const medal = medals[i] ?? `\`${String(i + 1).padStart(2)}.\``;
    const name  = guild?.members?.cache?.get(r.user_id)?.displayName ?? `<@${r.user_id}>`;
    const joined = r.total_joined ?? 0;
    const streak = r.current_streak ?? 0;
    const totalSessions = r.total_sessions ?? joined;
    const pct = totalSessions > 0 ? Math.round(joined / totalSessions * 100) : 0;
    return `${medal} **${name}** — ${joined} phiên · ${pct}% · 🔥 ${streak}`;
  });
  return {
    embeds: [new EmbedBuilder()
      // [FIX] COLORS.PURPLE không tồn tại → dùng COLORS.ACCENT
      .setColor(COLORS.ACCENT)
      .setTitle(`🏆 Top ${Math.min(rows.length, topN)} — Bảng xếp hạng`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: FOOTER_DEFAULT })
      .setTimestamp()],
    components: [],
  };
}

function renderLichSu(records, userId, guild, page = 0) {
  const PAGE_SIZE = 10;
  const total = records.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const clampedPage = Math.max(0, Math.min(page, totalPages - 1));
  const start = clampedPage * PAGE_SIZE;
  const slice = records.slice(start, start + PAGE_SIZE);

  const name = guild?.members?.cache?.get(userId)?.displayName ?? `<@${userId}>`;

  if (!total) {
    return {
      embeds: [new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`📋 Lịch sử — ${name}`)
        .setDescription('_Chưa có điểm danh nào._')
        .setFooter({ text: FOOTER_DEFAULT })
        .setTimestamp()],
      components: [],
    };
  }

  const statusEmoji = {
    tham_gia: '✅', tre: '🕐', khong_tham_gia: '❌', co_phep: '📋',
  };

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`📋 Lịch sử — ${name}`)
    .setDescription(
      slice.map((r, i) => {
        const emoji = statusEmoji[r.status] ?? '❓';
        const time = r.checked_in_at ? `<t:${Math.floor(new Date(r.checked_in_at).getTime() / 1000)}:f>` : '';
        const sessionName = r.sessions?.session_name ?? 'Phiên';
        return `\`${String(start + i + 1).padStart(2)}.\` ${emoji} **${sessionName}**${time ? ` · ${time}` : ''}`;
      }).join('\n')
    )
    .setFooter({ text: `${FOOTER_DEFAULT} · Trang ${clampedPage + 1}/${totalPages} · Tổng ${total} lần` })
    .setTimestamp();

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup:stats:lichsu:prev')
      .setLabel('◀ Trước')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(clampedPage === 0),
    new ButtonBuilder()
      .setCustomId('setup:stats:lichsu:next')
      .setLabel('Sau ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(clampedPage >= totalPages - 1),
  );

  return { embeds: [embed], components: [navRow], _page: clampedPage, _totalPages: totalPages };
}

function renderServerStats(stats) {
  const pct = stats.rate_present ?? 0;
  const embed = new EmbedBuilder()
    .setColor(pct >= 80 ? COLORS.SUCCESS : pct >= 50 ? COLORS.WARNING : COLORS.DANGER)
    .setTitle(`${ICONS.CHART} Thống kê Server`)
    .addFields(
      { name: '📅 Tổng phiên', value: `**${stats.total_sessions}**`, inline: true },
      { name: '👥 Thành viên', value: `**${stats.total_members}**`, inline: true },
      { name: '📝 Điểm danh', value: `**${stats.total_attendances}** lần`, inline: true },
      { name: `${pctEmoji(pct)} Tỉ lệ tham gia`, value: `\`${buildRichProgressBar(pct)}\` **${pct}%** — ${pctLabel(pct)}`, inline: false },
    )
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();
  return { embeds: [embed], components: [] };
}

function renderXemInput() {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('🔍 Xem điểm danh người khác')
    .setDescription('Nhập **User ID** hoặc **@mention** vào modal để xem thống kê của người đó.')
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.BACK_HOME)
      .setLabel('← Về Bảng điều khiển')
      .setEmoji(ICONS.HOME)
      .setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [backRow] };
}

module.exports = {
  StatsView: { renderStatsMenu, renderToi, renderRank, renderLichSu, renderServerStats, renderXemInput, CUSTOM_ID },
  BADGE_THRESHOLDS,
};
