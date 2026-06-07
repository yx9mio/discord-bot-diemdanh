// src/commands/setup/_views/_StatsView.js
// [FIX] renderLichSu: embed targetUserId vào footer để setupStatsLichsu.js parse đúng
// [FIX] renderServerStats: nhận tham số `top` và hiển thị breakdown 4 trạng thái đầy đủ
// [FIX] Encode ctx:<view> vào tất cả footers để REFRESH reload đúng view (sync main@5509e8d)
// [FIX] renderLichSu navRow: thêm REFRESH button
// [FIX] renderRank: async + guild.members.fetch() cho uncached users
// [UPG] renderToi: thêm total_absent, total_late từ stats
// [UPG] renderLichSu: tăng limit 200 + hiển thị rõ hơn per-status
// [UPG] renderRank: hiển thị phòng ban + % tỉ lệ
'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, ICONS } = require('../../../../utils/theme.js');
const { FOOTER_DEFAULT, buildRichProgressBar, pctEmoji, pctLabel } = require('../../../../utils/embeds.js');

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

// ─── ctx helpers (sync với main@5509e8d) ─────────────────────────────
// Encode "ctx:<key>" vào footer để setupStats.js REFRESH reload đúng view.
const CTX = {
  MENU:   'menu',
  TOI:    'toi',
  RANK:   'rank',
  SERVER: 'server',
  LICHSU: 'lichsu',
};

function _footer(ctx, extra = '') {
  const parts = [FOOTER_DEFAULT, `ctx:${ctx}`];
  if (extra) parts.push(extra);
  return parts.join(' · ');
}

// ─── Nav row dùng chung ───────────────────────────────────────────────
function _navRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.REFRESH).setLabel('Làm mới').setEmoji(ICONS.REFRESH).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.BACK_HOME).setLabel('← Dashboard').setEmoji(ICONS.HOME).setStyle(ButtonStyle.Secondary),
  );
}

// ─── Menu chính ───────────────────────────────────────────────────────
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
    .setFooter({ text: _footer(CTX.MENU) })
    .setTimestamp();

  const menuRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.TOI).setLabel('Của tôi').setEmoji(ICONS.PERSON).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.RANK).setLabel('Xếp hạng').setEmoji(ICONS.TROPHY).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(CUSTOM_ID.LICHSU).setLabel('Lịch sử').setEmoji('📋').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.XEM).setLabel('Xem người khác').setEmoji('🔍').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.SERVER).setLabel('Server').setEmoji(ICONS.CHART).setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [menuRow, _navRow()] };
}

// ─── Thống kê cá nhân ─────────────────────────────────────────────────
function renderToi(stats, member, guild, badges) {
  const joined  = stats?.total_joined   ?? 0;
  const total   = stats?.total_sessions ?? 0;
  const streak  = stats?.current_streak ?? 0;
  const best    = stats?.best_streak    ?? 0;
  const phong   = stats?.phong_ban      ?? '';
  const name    = member?.displayName ?? member?.user?.username ?? 'Thành viên';
  const pct     = total > 0 ? Math.round((joined / total) * 100) : 0;
  const bar     = buildRichProgressBar(pct);

  // [UPG] Tính absent + late từ total_sessions - total_joined nếu service chưa cung cấp riêng
  const late   = stats?.total_late   ?? null;
  const absent = stats?.total_absent ?? (total > 0 ? total - joined : null);

  const badgeStr = (badges ?? []).length
    ? badges.map(b => {
        const def = BADGE_THRESHOLDS.find(bt => bt.threshold === b.threshold);
        return def ? `${def.emoji} **${def.label}**` : `🎖️ ${b.threshold}`;
      }).join('  ')
    : '_Chưa có huy hiệu_';

  const fields = [
    { name: `${ICONS.ATTEND_YES} Đã tham gia`, value: `**${joined}** / ${total} phiên`, inline: true },
    { name: `${ICONS.FIRE} Streak hiện tại`,   value: `**${streak}** phiên liên tiếp`,  inline: true },
    { name: '🏆 Streak tốt nhất',              value: `**${best}** phiên`,               inline: true },
  ];

  // [UPG] Thêm dòng vắng/trễ nếu có dữ liệu
  if (late !== null || absent !== null) {
    const parts = [];
    if (late   !== null) parts.push(`${ICONS.ATTEND_LATE ?? '🕐'} Trễ: **${late}**`);
    if (absent !== null) parts.push(`${ICONS.ATTEND_NO ?? '❌'} Vắng: **${absent}**`);
    fields.push({ name: '📊 Chi tiết', value: parts.join('  ·  '), inline: false });
  }

  fields.push({ name: `${ICONS.STAR} Huy hiệu`, value: badgeStr, inline: false });

  const embed = new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle(`${ICONS.PERSON} ${name}`)
    .setDescription([
      phong ? `> 📌 **${phong}**` : null,
      total === 0
        ? '> _Chưa có dữ liệu điểm danh._'
        : `${pctEmoji(pct)} **Tỉ lệ tham gia: ${pct}%** — ${pctLabel(pct)}`,
      total > 0 ? `\`${bar}\`` : null,
    ].filter(Boolean).join('\n'))
    .addFields(...fields)
    // [FIX] Encode ctx:toi để REFRESH reload đúng view này
    .setFooter({ text: _footer(CTX.TOI) })
    .setTimestamp();

  if (typeof member?.displayAvatarURL === 'function') {
    const url = member.displayAvatarURL({ dynamic: true, size: 64 });
    if (url) embed.setThumbnail(url);
  }

  return { embeds: [embed], components: [_navRow()] };
}

// ─── Bảng xếp hạng ───────────────────────────────────────────────────
// [FIX] async để fetch uncached members → tránh hiển thị <@id>
async function renderRank(rows, guild, topN = 10) {
  const medals = ['🥇', '🥈', '🥉'];

  if (!rows?.length) {
    return {
      embeds: [new EmbedBuilder().setColor(COLORS.GOLD).setTitle(`${ICONS.TROPHY} Bảng xếp hạng`)
        .setDescription('> _Chưa có dữ liệu._')
        // [FIX] Encode ctx:rank
        .setFooter({ text: _footer(CTX.RANK) }).setTimestamp()],
      components: [_navRow()],
    };
  }

  // [FIX] Fetch uncached members trước khi render
  const uncached = rows.filter(r => !guild?.members?.cache?.has(r.user_id)).map(r => r.user_id);
  if (uncached.length && guild) {
    await guild.members.fetch({ user: uncached }).catch(() => null);
  }

  const lines = rows.slice(0, topN).map((r, i) => {
    const medal   = medals[i] ?? `\`${String(i + 1).padStart(2)}.\``;
    const gMember = guild?.members?.cache?.get(r.user_id);
    const name    = gMember?.displayName ?? `<@${r.user_id}>`;
    const phong   = r.phong_ban ?? gMember?.roles?.cache
      ?.filter(role => role.name !== '@everyone')
      ?.first()?.name ?? '';
    const joined  = r.total_joined   ?? 0;
    const streak  = r.current_streak ?? 0;
    const total   = r.total_sessions ?? joined;
    const pct     = total > 0 ? Math.round((joined / total) * 100) : 0;
    const phongStr = phong ? ` · 📌 ${phong}` : '';
    return `${medal} **${name}**${phongStr}\n\`${buildRichProgressBar(pct, 8)}\` **${pct}%** · ${joined} phiên · ${ICONS.FIRE}${streak}`;
  });

  return {
    embeds: [new EmbedBuilder().setColor(COLORS.GOLD)
      .setTitle(`${ICONS.TROPHY} Top ${Math.min(rows.length, topN)} — Bảng xếp hạng`)
      .setDescription(lines.join('\n\n'))
      // [FIX] Encode ctx:rank
      .setFooter({ text: _footer(CTX.RANK) }).setTimestamp()],
    components: [_navRow()],
  };
}

// ─── Lịch sử cá nhân ─────────────────────────────────────────────────
// [UPG] limit tăng lên 200 (khớp với attendanceService)
function renderLichSu(records, userId, guild, page = 0) {
  const PAGE_SIZE  = 10;
  const total      = records.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cPage      = Math.max(0, Math.min(page, totalPages - 1));
  const start      = cPage * PAGE_SIZE;
  const slice      = records.slice(start, start + PAGE_SIZE);

  const gMember = guild?.members?.cache?.get(userId);
  const name    = gMember?.displayName ?? `<@${userId}>`;

  const statusMap = {
    tham_gia:       { emoji: ICONS.ATTEND_YES    ?? '✅', label: 'Tham gia' },
    tre:            { emoji: ICONS.ATTEND_LATE   ?? '🕐', label: 'Trễ'     },
    khong_tham_gia: { emoji: ICONS.ATTEND_NO     ?? '❌', label: 'Vắng'    },
    co_phep:        { emoji: ICONS.ATTEND_EXCUSE ?? '📋', label: 'Có phép' },
  };

  if (!total) {
    return {
      embeds: [new EmbedBuilder().setColor(COLORS.PRIMARY).setTitle(`📋 Lịch sử — ${name}`)
        .setDescription('> _Chưa có điểm danh nào._')
        // [FIX] Encode ctx:lichsu + uid để REFRESH reload đúng
        .setFooter({ text: _footer(CTX.LICHSU, `uid:${userId}`) }).setTimestamp()],
      components: [_navRow()],
    };
  }

  // Tóm tắt trạng thái toàn bộ records
  const summary = { tham_gia: 0, tre: 0, khong_tham_gia: 0, co_phep: 0 };
  for (const r of records) {
    if (summary[r.status] !== undefined) summary[r.status]++;
  }
  const summaryStr = [
    `${statusMap.tham_gia.emoji} **${summary.tham_gia}** tham gia`,
    `${statusMap.tre.emoji} **${summary.tre}** trễ`,
    `${statusMap.khong_tham_gia.emoji} **${summary.khong_tham_gia}** vắng`,
    `${statusMap.co_phep.emoji} **${summary.co_phep}** có phép`,
  ].join('  ·  ');

  const lines = slice.map((r, i) => {
    const s    = statusMap[r.status] ?? { emoji: '❓', label: r.status };
    const time = r.checked_in_at
      ? `<t:${Math.floor(new Date(r.checked_in_at).getTime() / 1000)}:d>`
      : '—';
    const sessionName = r.sessions?.session_name ?? 'Phiên';
    return `\`${String(start + i + 1).padStart(2)}.\` ${s.emoji} **${sessionName}** · ${time}`;
  });

  // [FIX] navRow: prev/next + REFRESH + BACK_HOME (trước thiếu REFRESH)
  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:stats:lichsu:prev').setLabel('◄ Trang trước').setStyle(ButtonStyle.Secondary).setDisabled(cPage === 0),
    new ButtonBuilder().setCustomId('setup:stats:lichsu:next').setLabel('Trang sau ►').setStyle(ButtonStyle.Secondary).setDisabled(cPage >= totalPages - 1),
    new ButtonBuilder().setCustomId(CUSTOM_ID.REFRESH).setLabel('Làm mới').setEmoji(ICONS.REFRESH).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.BACK_HOME).setLabel('← Dashboard').setEmoji(ICONS.HOME).setStyle(ButtonStyle.Secondary),
  );

  // [FIX] Footer encode ctx:lichsu + uid + trang để REFRESH & pagination đọc đúng người và view
  const footerText = _footer(CTX.LICHSU, `uid:${userId} · Trang ${cPage + 1}/${totalPages} · Tổng ${total} lần`);

  return {
    embeds: [new EmbedBuilder().setColor(COLORS.PRIMARY)
      .setTitle(`📋 Lịch sử — ${name}`)
      .setDescription(`${summaryStr}\n\n${lines.join('\n')}`)
      .setFooter({ text: footerText })
      .setTimestamp()],
    components: [navRow],
    _page: cPage,
    _totalPages: totalPages,
  };
}

// ─── Thống kê server ─────────────────────────────────────────────────
/**
 * @param {object} stats  — kết quả từ getServerStats() (đã có breakdown đầy đủ)
 * @param {Array}  top    — mảng từ getTopMembers(), có thể undefined/null
 * @param {object} guild  — Guild object để resolve displayName
 */
function renderServerStats(stats, top, guild) {
  const pct      = stats?.rate_present      ?? 0;
  const total    = stats?.total_sessions    ?? 0;
  const members  = stats?.total_members     ?? 0;
  const attends  = stats?.total_attendances ?? 0;

  // [UPG] Breakdown 4 trạng thái
  const nPresent = stats?.total_present  ?? null;
  const nLate    = stats?.total_late     ?? null;
  const nAbsent  = stats?.total_absent   ?? null;
  const nExcused = stats?.total_excused  ?? null;
  const rLate    = stats?.rate_late      ?? null;
  const rAbsent  = stats?.rate_absent    ?? null;
  const rExcused = stats?.rate_excused   ?? null;

  const color = pct >= 80 ? COLORS.GREEN : pct >= 50 ? COLORS.YELLOW : COLORS.RED;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${ICONS.CHART} Thống kê Server`)
    .setDescription([
      `${pctEmoji(pct)} **Tỉ lệ tham gia trung bình: ${pct}%** — ${pctLabel(pct)}`,
      `\`${buildRichProgressBar(pct)}\``,
    ].join('\n'))
    .addFields(
      { name: '📅 Tổng phiên',                 value: `**${total}** phiên`,   inline: true },
      { name: '👥 Thành viên',                  value: `**${members}** người`, inline: true },
      { name: `${ICONS.ATTEND_YES} Điểm danh`, value: `**${attends}** lượt`,  inline: true },
    )
    // [FIX] Encode ctx:server để REFRESH reload đúng view này
    .setFooter({ text: _footer(CTX.SERVER) })
    .setTimestamp();

  // [UPG] Breakdown chi tiết nếu service trả về
  if (nPresent !== null || nLate !== null || nAbsent !== null || nExcused !== null) {
    const breakdownLines = [
      nPresent !== null ? `${ICONS.ATTEND_YES  ?? '✅'} Tham gia: **${nPresent}** lượt` : null,
      nLate    !== null ? `${ICONS.ATTEND_LATE ?? '🕐'} Trễ: **${nLate}** lượt (${rLate ?? 0}%)` : null,
      nAbsent  !== null ? `${ICONS.ATTEND_NO   ?? '❌'} Vắng: **${nAbsent}** lượt (${rAbsent ?? 0}%)` : null,
      nExcused !== null ? `${ICONS.ATTEND_EXCUSE ?? '📋'} Có phép: **${nExcused}** lượt (${rExcused ?? 0}%)` : null,
    ].filter(Boolean);
    if (breakdownLines.length) {
      embed.addFields({ name: '📊 Breakdown', value: breakdownLines.join('\n'), inline: false });
    }
  }

  // Mini top-5 nếu có data
  if (Array.isArray(top) && top.length > 0) {
    const medals = ['🥇', '🥈', '🥉', '`4.`', '`5.`'];
    const lines = top.slice(0, 5).map((r, i) => {
      const nm     = guild?.members?.cache?.get(r.user_id)?.displayName ?? `<@${r.user_id}>`;
      const joined = r.total_joined   ?? 0;
      const streak = r.current_streak ?? 0;
      const totalS = r.total_sessions ?? joined;
      const pctR   = totalS > 0 ? Math.round((joined / totalS) * 100) : 0;
      return `${medals[i]} **${nm}** — **${pctR}%** · ${joined} phiên · ${ICONS.FIRE}${streak}`;
    });
    embed.addFields({ name: `${ICONS.TROPHY} Top thành viên`, value: lines.join('\n'), inline: false });
  }

  return { embeds: [embed], components: [_navRow()] };
}

// ─── Xem người khác ───────────────────────────────────────────────────
function renderXemInput() {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('🔍 Xem điểm danh người khác')
    .setDescription('Nhập **User ID** hoặc **@mention** vào modal.')
    // [FIX] Encode ctx:menu để REFRESH về menu
    .setFooter({ text: _footer(CTX.MENU) })
    .setTimestamp();

  return { embeds: [embed], components: [_navRow()] };
}

module.exports = {
  StatsView: { renderStatsMenu, renderToi, renderRank, renderLichSu, renderServerStats, renderXemInput, CUSTOM_ID },
  BADGE_THRESHOLDS,
};
