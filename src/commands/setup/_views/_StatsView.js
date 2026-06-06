'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, ICONS } = require('../../../utils/theme.js');
const { FOOTER_DEFAULT, buildRichProgressBar, pctEmoji, pctLabel } = require('../../../utils/embeds.js');

const CUSTOM_ID = {
  TOI:       'setup:stats:toi',
  RANK:      'setup:stats:rank',
  LICHSU:    'setup:stats:lichsu',
  XEM:       'setup:stats:xem',
  SERVER:    'setup:stats:server',
  REFRESH:   'setup:stats:refresh',
  BACK_HOME: 'setup:home',
};

const BADGE_THRESHOLDS = [
  { threshold: 100, label: 'Vua Điểm Danh', emoji: '👑' },
  { threshold: 50,  label: 'Huyền Thoại',   emoji: '🏆' },
  { threshold: 30,  label: 'Kiên Trì',       emoji: '🥇' },
  { threshold: 20,  label: 'Chuyên Cần',     emoji: '🥈' },
  { threshold: 10,  label: 'Cần Cù',         emoji: '🥉' },
  { threshold: 5,   label: 'Lính Mới',       emoji: '⭐' },
];

function _badgeStr(badges) {
  if (!badges?.length) return '_Chưa có huy hiệu_';
  return badges
    .map(b => {
      const t = BADGE_THRESHOLDS.find(bt => bt.threshold === b.threshold);
      return t ? `${t.emoji} **${t.label}**` : `🎖️ ${b.threshold}`;
    })
    .join('  ');
}

function renderStatsMenu() {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`${ICONS.CHART} Thống kê Điểm danh`)
    .setDescription([
      '> Chọn một mục bên dưới để xem thống kê.',
      '',
      `**${ICONS.PERSON} Của tôi** — Số phiên, streak và huy hiệu của bạn`,
      `**${ICONS.TROPHY} Xếp hạng** — Top 10 thành viên tích cực nhất`,
      `**📋 Lịch sử** — Xem lại các phiên đã điểm danh`,
      `**🔍 Xem người khác** — Tra cứu thống kê bất kỳ thành viên`,
      `**${ICONS.CHART} Server** — Tổng quan toàn server`,
    ].join('\n'))
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.TOI).setLabel('Của tôi').setEmoji(ICONS.PERSON).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.RANK).setLabel('Xếp hạng').setEmoji(ICONS.TROPHY).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(CUSTOM_ID.LICHSU).setLabel('Lịch sử').setEmoji('📋').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.XEM).setLabel('Xem người khác').setEmoji('🔍').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.SERVER).setLabel('Server').setEmoji(ICONS.CHART).setStyle(ButtonStyle.Secondary),
  );
  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.REFRESH).setLabel('Làm mới').setEmoji(ICONS.REFRESH).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.BACK_HOME).setLabel('← Bảng điều khiển').setEmoji(ICONS.HOME).setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [row, navRow] };
}

function renderToi(stats, member, guild, badges) {
  const joined  = stats?.total_joined   ?? 0;
  const total   = stats?.total_sessions ?? 0;
  const streak  = stats?.current_streak ?? 0;
  const best    = stats?.best_streak    ?? 0;
  const phong   = stats?.phong_ban      ?? '';
  const name    = member?.displayName ?? member?.user?.username ?? 'Thành viên';
  const pct     = total > 0 ? Math.round(joined / total * 100) : 0;
  const bar     = buildRichProgressBar(pct);

  // Tính vắng + có phép/trễ từ total_sessions và total_joined
  // member_stats chỉ lưu total_joined (tham_gia + tre) — vắng = total - joined
  const vang    = Math.max(0, total - joined);

  const noData  = total === 0;

  const embed = new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle(`${ICONS.PERSON} ${name}`)
    .setDescription(
      noData
        ? '> _Thành viên chưa tham gia phiên nào._'
        : [
            phong ? `> 📌 **${phong}**` : null,
            `${pctEmoji(pct)} **Tỉ lệ tham gia: ${pct}%** — ${pctLabel(pct)}`,
            `\`${bar}\``,
          ].filter(Boolean).join('\n'),
    )
    .addFields(
      { name: `${ICONS.ATTEND_YES} Đã tham gia`,    value: `**${joined}** / ${total} phiên`, inline: true },
      { name: `${ICONS.ATTEND_NO} Vắng`,            value: `**${vang}** phiên`,              inline: true },
      { name: `${ICONS.FIRE} Streak hiện tại`,      value: `**${streak}** liên tiếp`,        inline: true },
      { name: '🏆 Streak tốt nhất',                  value: `**${best}** phiên`,             inline: true },
      { name: `${ICONS.STAR} Huy hiệu`,              value: _badgeStr(badges),               inline: false },
    )
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  if (typeof member?.displayAvatarURL === 'function') {
    const url = member.displayAvatarURL({ dynamic: true, size: 64 });
    if (url) embed.setThumbnail(url);
  }
  return { embeds: [embed], components: [] };
}

/**
 * @param {object[]} rows  – rows từ getTopMembers()
 * @param {import('discord.js').Guild} guild
 * @param {number} topN
 */
async function renderRank(rows, guild, topN = 10) {
  const empty = new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle(`${ICONS.TROPHY} Bảng xếp hạng`)
    .setDescription('> _Chưa có dữ liệu._')
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();
  if (!rows?.length) return { embeds: [empty], components: [] };

  // Fetch members không có trong cache để lấy displayName
  const uncached = rows.filter(r => !guild?.members?.cache?.has(r.user_id)).map(r => r.user_id);
  if (uncached.length && guild) {
    await guild.members.fetch({ user: uncached }).catch(() => null);
  }

  const medals = ['🥇', '🥈', '🥉'];
  const lines = rows.slice(0, topN).map((r, i) => {
    const medal  = medals[i] ?? `\`${String(i + 1).padStart(2)}.\``;
    const name   = guild?.members?.cache?.get(r.user_id)?.displayName ?? `<@${r.user_id}>`;
    const joined = r.total_joined   ?? 0;
    const streak = r.current_streak ?? 0;
    const total  = r.total_sessions ?? joined;
    const pct    = total > 0 ? Math.round(joined / total * 100) : 0;
    const vang   = Math.max(0, total - joined);
    return [
      `${medal} **${name}**`,
      `\`${buildRichProgressBar(pct, 8)}\` ${pct}% · ${ICONS.ATTEND_YES}${joined} · ${ICONS.ATTEND_NO}${vang} · ${ICONS.FIRE}${streak}`,
    ].join('\n');
  });

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(COLORS.GOLD)
        .setTitle(`${ICONS.TROPHY} Top ${Math.min(rows.length, topN)} — Bảng xếp hạng`)
        .setDescription(lines.join('\n\n'))
        .setFooter({ text: `${FOOTER_DEFAULT} · Cập nhật lần cuối` })
        .setTimestamp(),
    ],
    components: [],
  };
}

/**
 * Render lịch sử điểm danh.
 * Footer encode userId để pagination đọc lại đúng người (kể cả khi admin xem người khác).
 *
 * @param {object[]} records  – từ getAttendancesByUser()
 * @param {string}   userId   – ID người được xem
 * @param {import('discord.js').Guild} guild
 * @param {number}   page     – 0-indexed
 */
function renderLichSu(records, userId, guild, page = 0) {
  const PAGE_SIZE   = 10;
  const total       = records.length;
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const clampedPage = Math.max(0, Math.min(page, totalPages - 1));
  const start       = clampedPage * PAGE_SIZE;
  const slice       = records.slice(start, start + PAGE_SIZE);
  const name        = guild?.members?.cache?.get(userId)?.displayName ?? `<@${userId}>`;

  // Tính tổng tham gia / vắng để hiển thị trong header
  const tongThamGia = records.filter(r => r.status === 'tham_gia' || r.status === 'tre').length;
  const tongVang    = records.filter(r => r.status === 'khong_tham_gia').length;
  const tongCoPhep  = records.filter(r => r.status === 'co_phep').length;

  if (!total) {
    return {
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.PRIMARY)
          .setTitle(`📋 Lịch sử — ${name}`)
          .setDescription('> _Chưa có điểm danh nào._')
          // Vẫn encode userId vào footer phòng trường hợp admin reload
          .setFooter({ text: `${FOOTER_DEFAULT} · uid:${userId}` })
          .setTimestamp(),
      ],
      components: [],
    };
  }

  const statusMap = {
    tham_gia:        { emoji: ICONS.ATTEND_YES },
    tre:             { emoji: ICONS.ATTEND_LATE },
    khong_tham_gia:  { emoji: ICONS.ATTEND_NO },
    co_phep:         { emoji: ICONS.ATTEND_EXCUSE },
  };

  const lines = slice.map((r, i) => {
    const s    = statusMap[r.status] ?? { emoji: '❓' };
    const time = r.checked_in_at
      ? `<t:${Math.floor(new Date(r.checked_in_at).getTime() / 1000)}:d>`
      : '—';
    return `\`${String(start + i + 1).padStart(2)}.\` ${s.emoji} **${r.sessions?.session_name ?? 'Phiên'}** · ${time}`;
  });

  // Dòng tóm tắt ở đầu description
  const summary = `> ${ICONS.ATTEND_YES} **${tongThamGia}** tham gia · ${ICONS.ATTEND_NO} **${tongVang}** vắng · 🟡 **${tongCoPhep}** có phép\n`;

  // Encode userId vào footer để _extractPageFromEmbed đọc lại khi paginate
  const footerText = `${FOOTER_DEFAULT} · Trang ${clampedPage + 1}/${totalPages} · ${total} bản ghi · uid:${userId}`;

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`📋 Lịch sử — ${name}`)
    .setDescription(summary + lines.join('\n'))
    .setFooter({ text: footerText })
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

  return { embeds: [embed], components: [navRow] };
}

function renderServerStats(stats) {
  const pct     = stats?.rate_present      ?? 0;
  const total   = stats?.total_sessions    ?? 0;
  const members = stats?.total_members     ?? 0;
  const attends = stats?.total_attendances ?? 0;
  const color   = pct >= 80 ? COLORS.GREEN : pct >= 50 ? COLORS.YELLOW : COLORS.RED;

  // Tính số điểm danh hợp lệ (tham_gia + tre)
  const avgPerSession = total > 0 && members > 0
    ? (attends / total).toFixed(1)
    : '—';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${ICONS.CHART} Thống kê Server`)
    .setDescription([
      `${pctEmoji(pct)} **Tỉ lệ tham gia trung bình: ${pct}%** — ${pctLabel(pct)}`,
      `\`${buildRichProgressBar(pct)}\``,
    ].join('\n'))
    .addFields(
      { name: '📅 Tổng phiên',           value: `**${total}** phiên`,                       inline: true },
      { name: '👥 Thành viên',           value: `**${members}** người`,                     inline: true },
      { name: `${ICONS.ATTEND_YES} Điểm danh`, value: `**${attends}** lượt`,               inline: true },
      { name: '📊 TB mỗi phiên',         value: `**${avgPerSession}** lượt/phiên`,          inline: true },
    )
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  return { embeds: [embed], components: [] };
}

function renderXemInput() {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('🔍 Xem điểm danh người khác')
    .setDescription('Nhập **User ID** hoặc **@mention** vào modal.')
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();
  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.REFRESH).setLabel('Làm mới').setEmoji(ICONS.REFRESH).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.BACK_HOME).setLabel('← Bảng điều khiển').setEmoji(ICONS.HOME).setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [navRow] };
}

module.exports = {
  StatsView: { renderStatsMenu, renderToi, renderRank, renderLichSu, renderServerStats, renderXemInput, CUSTOM_ID },
  BADGE_THRESHOLDS,
};
