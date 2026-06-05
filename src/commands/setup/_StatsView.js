'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {
  COLORS, ICONS,
  FOOTER_DEFAULT,
  buildRichProgressBar, pctEmoji, pctLabel,
} = require('../../../utils/embeds.js');
const { fmtTs } = require('../../../utils/format.js');

const CUSTOM_ID = {
  TOI:       'setup:stats:toi',
  RANK:      'setup:stats:rank',
  LICHSU:    'setup:stats:lichsu',
  XEM:       'setup:stats:xem',
  SERVER:    'setup:stats:server',
  REFRESH:   'setup:stats:refresh',  // [REFRESH-ALL]
  BACK_HOME: 'setup:home',
};

const BADGE_THRESHOLDS = [
  { threshold: 100, label: 'Vua Điểm Danh', emoji: '👑' },
  { threshold: 50,  label: 'Huyền Thoại',   emoji: '🏆' },
  { threshold: 30,  label: 'Kiên Trì',      emoji: '🥇' },
  { threshold: 20,  label: 'Chuyên Cần',    emoji: '🥈' },
  { threshold: 10,  label: 'Cần Cù',        emoji: '🥉' },
  { threshold: 5,   label: 'Lính Mới',      emoji: '⭐' },
];

// ─── Menu chính ─────────────────────────────────────────────────────────────────
function renderStatsMenu() {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`${ICONS.CHART} Thống kê Điểm danh`)
    .setDescription(
      [
        '> Chọn một mục bên dưới để xem thống kê.',
        '',
        `**${ICONS.PERSON} Của tôi** — Số phiên, streak và huy hiệu của bạn`,
        `**${ICONS.TROPHY} Xếp hạng** — Top 10 thành viên tích cực nhất`,
        `**📋 Lịch sử** — Xem lại các phiên đã điểm danh`,
        `**🔍 Xem người khác** — Tra cứu thống kê bất kỳ thành viên`,
        `**${ICONS.CHART} Server** — Tổng quan toàn server`,
      ].join('\n')
    )
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.TOI).setLabel('Của tôi').setEmoji(ICONS.PERSON).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.RANK).setLabel('Xếp hạng').setEmoji(ICONS.TROPHY).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(CUSTOM_ID.LICHSU).setLabel('Lịch sử').setEmoji('📋').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.XEM).setLabel('Xem người khác').setEmoji('🔍').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.SERVER).setLabel('Server').setEmoji(ICONS.CHART).setStyle(ButtonStyle.Secondary),
  );

  // [REFRESH-ALL] Làm mới + Back — dùng ICONS.HOME thay vì hardcode '🏠'
  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.REFRESH)
      .setLabel('Làm mới')
      .setEmoji(ICONS.REFRESH)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.BACK_HOME)
      .setLabel('← Bảng điều khiển')
      .setEmoji(ICONS.HOME)
      .setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row, navRow] };
}

// ─── Thống kê cá nhân ────────────────────────────────────────────────────────────
function renderToi(stats, member, guild, badges) {
  const joined  = stats?.total_joined    ?? 0;
  const total   = stats?.total_sessions  ?? 0;
  const streak  = stats?.current_streak  ?? 0;
  const best    = stats?.best_streak     ?? 0;
  const phong   = stats?.phong_ban       ?? '';
  const name    = member?.displayName ?? member?.user?.username ?? 'Thành viên';

  const pct     = total > 0 ? Math.round(joined / total * 100) : 0;
  const bar     = buildRichProgressBar(pct);
  const emoji   = pctEmoji(pct);
  const label   = pctLabel(pct);

  const badgeStr = (badges ?? []).length
    ? (badges ?? []).map(b => {
        const t = BADGE_THRESHOLDS.find(bt => bt.threshold === b.threshold);
        return t ? `${t.emoji} **${t.label}**` : `🎖️ ${b.threshold}`;
      }).join('  ')
    : '_Chưa có huy hiệu_';

  const embed = new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle(`${ICONS.PERSON} ${name}`)
    .setDescription(
      [
        phong ? `> 📌 **${phong}**` : null,
        `${emoji} **Tỉ lệ tham gia: ${pct}%** — ${label}`,
        `\`${bar}\``,
      ].filter(Boolean).join('\n')
    )
    .addFields(
      { name: `${ICONS.ATTEND_YES} Đã tham gia`,      value: `**${joined}** / ${total} phiên`, inline: true },
      { name: `${ICONS.FIRE} Streak hiện tại`, value: `**${streak}** phiên liên tiếp`,  inline: true },
      { name: '🏆 Streak tốt nhất',       value: `**${best}** phiên`,             inline: true },
      { name: `${ICONS.STAR} Huy hiệu`,           value: badgeStr,                       inline: false },
    )
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  if (typeof member?.displayAvatarURL === 'function') {
    const url = member.displayAvatarURL({ dynamic: true, size: 64 });
    if (url) embed.setThumbnail(url);
  }

  return { embeds: [embed], components: [] };
}

// ─── Xếp hạng ──────────────────────────────────────────────────────────────────
function renderRank(rows, guild, topN = 10) {
  if (!rows?.length) {
    return {
      embeds: [new EmbedBuilder()
        .setColor(COLORS.GOLD)
        .setTitle(`${ICONS.TROPHY} Bảng xếp hạng`)
        .setDescription('> _Chưa có dữ liệu xếp hạng._')
        .setFooter({ text: FOOTER_DEFAULT })
        .setTimestamp()],
      components: [],
    };
  }

  const medals = ['🥇', '🥈', '🥉'];
  const lines = rows.slice(0, topN).map((r, i) => {
    const medal   = medals[i] ?? `\`${String(i + 1).padStart(2)}.\``;
    const name    = guild?.members?.cache?.get(r.user_id)?.displayName ?? `<@${r.user_id}>`;
    const joined  = r.total_joined ?? 0;
    const streak  = r.current_streak ?? 0;
    const total   = r.total_sessions ?? joined;
    const pct     = total > 0 ? Math.round(joined / total * 100) : 0;
    const bar     = buildRichProgressBar(pct, 8);
    return `${medal} **${name}**\n\`${bar}\` ${pct}% · ${joined} phiên · ${ICONS.FIRE}${streak}`;
  });

  return {
    embeds: [new EmbedBuilder()
      .setColor(COLORS.GOLD)
      .setTitle(`${ICONS.TROPHY} Top ${Math.min(rows.length, topN)} — Bảng xếp hạng`)
      .setDescription(lines.join('\n\n'))
      .setFooter({ text: `${FOOTER_DEFAULT} · Cập nhật lần cuối` })
      .setTimestamp()],
    components: [],
  };
}

// ─── Lịch sử điểm danh ───────────────────────────────────────────────────────────
function renderLichSu(records, userId, guild, page = 0) {
  const PAGE_SIZE  = 10;
  const total      = records.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const clampedPage = Math.max(0, Math.min(page, totalPages - 1));
  const start = clampedPage * PAGE_SIZE;
  const slice = records.slice(start, start + PAGE_SIZE);
  const name  = guild?.members?.cache?.get(userId)?.displayName ?? `<@${userId}>`;

  if (!total) {
    return {
      embeds: [new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`📋 Lịch sử — ${name}`)
        .setDescription('> _Chưa có điểm danh nào._')
        .setFooter({ text: FOOTER_DEFAULT })
        .setTimestamp()],
      components: [],
    };
  }

  const statusMap = {
    tham_gia:       { emoji: ICONS.ATTEND_YES,    label: 'Tham gia' },
    tre:            { emoji: ICONS.ATTEND_LATE,   label: 'Trễ' },
    khong_tham_gia: { emoji: ICONS.ATTEND_NO,     label: 'Vắng' },
    co_phep:        { emoji: ICONS.ATTEND_EXCUSE, label: 'Có phép' },
  };

  const lines = slice.map((r, i) => {
    const s    = statusMap[r.status] ?? { emoji: '❓', label: r.status };
    const time = r.checked_in_at
      ? `<t:${Math.floor(new Date(r.checked_in_at).getTime() / 1000)}:d>`
      : '—';
    const sName = r.sessions?.session_name ?? 'Phiên';
    return `\`${String(start + i + 1).padStart(2)}.\` ${s.emoji} **${sName}** · ${time}`;
  });

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`📋 Lịch sử — ${name}`)
    .setDescription(lines.join('\n'))
    .setFooter({ text: `${FOOTER_DEFAULT} · Trang ${clampedPage + 1}/${totalPages} · Tổng ${total} lần` })
    .setTimestamp();

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup:stats:lichsu:prev')
      .setLabel('◄ Trang trước')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(clampedPage === 0),
    new ButtonBuilder()
      .setCustomId('setup:stats:lichsu:next')
      .setLabel('Trang sau ►')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(clampedPage >= totalPages - 1),
  );

  return { embeds: [embed], components: [navRow], _page: clampedPage, _totalPages: totalPages };
}

// ─── Thống kê Server ────────────────────────────────────────────────────────────
function renderServerStats(stats) {
  const pct     = stats?.rate_present    ?? 0;
  const total   = stats?.total_sessions  ?? 0;
  const members = stats?.total_members   ?? 0;
  const attends = stats?.total_attendances ?? 0;
  const bar     = buildRichProgressBar(pct);
  const emoji   = pctEmoji(pct);
  const label   = pctLabel(pct);

  const color = pct >= 80 ? COLORS.GREEN : pct >= 50 ? COLORS.YELLOW : COLORS.RED;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${ICONS.CHART} Thống kê Server`)
    .setDescription(
      [
        `${emoji} **Tỉ lệ tham gia trung bình: ${pct}%** — ${label}`,
        `\`${bar}\``,
      ].join('\n')
    )
    .addFields(
      { name: '📅 Tổng phiên',       value: `**${total}** phiên`,       inline: true },
      { name: '👥 Thành viên',        value: `**${members}** người`,     inline: true },
      { name: `${ICONS.ATTEND_YES} Điểm danh`, value: `**${attends}** lượt`, inline: true },
    )
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  return { embeds: [embed], components: [] };
}

// ─── Xem input ─────────────────────────────────────────────────────────────────
function renderXemInput() {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('🔍 Xem điểm danh người khác')
    .setDescription('Nhập **User ID** hoặc **@mention** vào modal để xem thống kê của người đó.')
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  // [REFRESH-ALL] dùng ICONS.HOME thay vì hardcode '🏠'
  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.REFRESH)
      .setLabel('Làm mới')
      .setEmoji(ICONS.REFRESH)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.BACK_HOME)
      .setLabel('← Bảng điều khiển')
      .setEmoji(ICONS.HOME)
      .setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [navRow] };
}

module.exports = {
  StatsView: { renderStatsMenu, renderToi, renderRank, renderLichSu, renderServerStats, renderXemInput, CUSTOM_ID },
  BADGE_THRESHOLDS,
};
