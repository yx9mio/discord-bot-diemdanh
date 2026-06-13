// src/commands/setup/_views/_StatsView.js
// [FIX] renderToi: nhận thêm viewerId để encode uid:${userId} vào footer
//   → REFRESH "xem người khác" reload đúng target, không fall về interaction.user.id
// [FIX] renderLichSu: embed uid:userId vào footer để setupStatsLichsu pagination đúng
// [FIX] renderServerStats: breakdown 4 trạng thái đầy đủ
// [FIX] Encode ctx:<view> vào mọi footers để REFRESH reload đúng view
// [FIX] renderRank: async + guild.members.fetch() cho uncached users + phòng ban
// [UPG] renderToi: hiển thị banner "Đang xem thành viên khác" khi viewerId !== userId
// [UPG] renderToi: total_absent, total_late từ getMemberStats (đã có trả về)
// [UPG] renderLichSu: limit 200, summary 4 trạng thái, REFRESH button trong navRow
'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { COLORS, ICONS, getPhaiIcon, formatPhaiList } = require('../../../../utils/theme.js');
const { FOOTER_DEFAULT, buildRichProgressBar, pctEmoji, pctLabel, buildAuthor } = require('../../../../utils/embeds.js');

const CUSTOM_ID = {
  TOI:       'setup:stats:toi',
  RANK:      'setup:stats:rank',
  LICHSU:    'setup:stats:lichsu',
  XEM:       'setup:stats:xem',
  SERVER:    'setup:stats:server',
  REFRESH:   'setup:stats:refresh',
  BACK_HOME: 'setup:home',
  PHONG_BAN_SELECT:    'setup:stats:rank:pb',
  RANK_PHAI_PREFIX:    'setup:stats:rank:phai:',
  RANK_ALL:            'setup:stats:rank:all',
  SERVER_PERIOD_WEEK:  'setup:stats:server:period:week',
  SERVER_PERIOD_MONTH: 'setup:stats:server:period:month',
  SERVER_PERIOD_ALL:   'setup:stats:server:period:all',
};

const BADGE_THRESHOLDS = [
  { threshold: 5,   label: 'Lính Mới',     emoji: '🌱' },
  { threshold: 10,  label: 'Cần Cù',        emoji: '⭐' },
  { threshold: 20,  label: 'Chuyên Cần',    emoji: '🌟' },
  { threshold: 30,  label: 'Kiên Trì',      emoji: '💪' },
  { threshold: 50,  label: 'Huyền Thoại',   emoji: '🏆' },
  { threshold: 100, label: 'Vua Điểm Danh', emoji: '👑' },
];

// ─── ctx helpers ─────────────────────────────────────────────────────
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
/**
 * @param {object|null} stats   — kết quả từ getMemberStats() (có total_late, total_absent)
 * @param {GuildMember} member  — GuildMember object (để lấy displayName, avatar)
 * @param {Guild}       guild   — Guild object
 * @param {Array}       badges  — mảng badge objects
 * @param {string}     [viewerId] — interaction.user.id; nếu khác userId thì encode uid vào footer
 * @param {object}     [cfg]      — guild config
 */
function renderToi(stats, member, guild, badges, viewerId = null, cfg = null) {
  const userId  = member?.id ?? member?.user?.id;
  const joined  = stats?.total_joined   ?? 0;
  const total   = stats?.total_sessions ?? 0;
  const streak  = stats?.current_streak ?? 0;
  const best    = stats?.best_streak    ?? 0;
  const phong   = stats?.phong_ban      ?? '';
  const name    = member?.displayName ?? member?.user?.username ?? 'Thành viên';
  const pct     = total > 0 ? Math.round((joined / total) * 100) : 0;
  const bar     = buildRichProgressBar(pct);

  // late/absent/excused đã được getMemberStats() tính sẵn
  const late    = stats?.total_late    ?? null;
  const absent  = stats?.total_absent  ?? null;
  const excused = stats?.total_excused ?? null;

  const badgeStr = (badges ?? []).length
    ? badges.map(b => {
        const def = BADGE_THRESHOLDS.find(bt => bt.threshold === b.threshold);
        return def ? `${def.emoji} **${def.label}**` : `🎖️ Mốc ${b.threshold}`;
      }).join('  ')
    : '_Chưa có huy hiệu_';

  const fields = [
    { name: `${ICONS.ATTEND_YES} Đã tham gia`, value: `**${joined}** / ${total} phiên`, inline: true },
    { name: `${ICONS.FIRE} Streak hiện tại`,   value: `**${streak}** phiên liên tiếp`,  inline: true },
    { name: '🏆 Streak tốt nhất',              value: `**${best}** phiên`,               inline: true },
  ];

  // Dòng breakdown vắng/trễ/có phép nếu có dữ liệu
  const breakdownParts = [
    late    !== null ? `${ICONS.ATTEND_LATE ?? '⏰'} Trễ: **${late}**`         : null,
    absent  !== null ? `${ICONS.ATTEND_NO   ?? '❌'} Vắng: **${absent}**`      : null,
    excused !== null ? `${ICONS.ATTEND_EXCUSE ?? '📋'} Có phép: **${excused}**` : null,
  ].filter(Boolean);
  if (breakdownParts.length) {
    fields.push({ name: '📊 Chi tiết', value: breakdownParts.join('  ·  '), inline: false });
  }

  fields.push({ name: `${ICONS.STAR} Huy hiệu`, value: badgeStr, inline: false });

  // [FIX] encode uid vào footer khi viewerId khác userId (admin xem người khác)
  // → setupStats.js REFRESH handler _readUid() sẽ đọc được targetId đúng
  const isViewingOther = viewerId && userId && viewerId !== userId;
  const footerExtra    = isViewingOther ? `uid:${userId}` : '';

  const phaiRoles = stats?.phai_role_ids ?? [];
  const phaiStr   = formatPhaiList(phaiRoles, guild, cfg?.phai_role_icons);

  const descParts = [
    isViewingOther ? `> 🔍 Đang xem thành viên khác` : null,
    phaiStr ? `> ${phaiStr}` : null,
    phong ? `> 📌 **${phong}**` : null,
    total === 0
      ? '> _Chưa có dữ liệu điểm danh._'
      : `${pctEmoji(pct)} **Tỉ lệ tham gia: ${pct}%** — ${pctLabel(pct)}`,
    total > 0 ? `\`${bar}\`` : null,
  ].filter(Boolean);

  const embed = new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setAuthor(buildAuthor(guild))
    .setTitle(`${ICONS.PERSON} ${name}`)
    .setDescription(descParts.join('\n'))
    .addFields(...fields)
    .setFooter({ text: _footer(CTX.TOI, footerExtra) })
    .setTimestamp();

  if (typeof member?.displayAvatarURL === 'function') {
    const url = member.displayAvatarURL({ dynamic: true, size: 64 });
    if (url) embed.setThumbnail(url);
  }

  return { embeds: [embed], components: [_navRow()] };
}

// ─── Bảng xếp hạng ───────────────────────────────────────────────────
// async để fetch uncached members → tránh hiển thị <@id>
async function renderRank(rows, guild, topN = 10, phongBanList = [], selectedPhongBan = '', cfg = null, filterPhaiRoleId = '') {
  const medals = ['🥇', '🥈', '🥉'];

  if (!rows?.length) {
    return {
      embeds: [new EmbedBuilder().setColor(COLORS.GOLD).setAuthor(buildAuthor(guild)).setTitle(`${ICONS.TROPHY} Bảng xếp hạng`)
        .setDescription('> _Chưa có dữ liệu._')
        .setFooter({ text: _footer(CTX.RANK) }).setTimestamp()],
      components: [_navRow()],
    };
  }

  // Fetch uncached members trước khi render
  const uncached = rows.filter(r => !guild?.members?.cache?.has(r.user_id)).map(r => r.user_id);
  if (uncached.length && guild) {
    await guild.members.fetch({ user: uncached }).catch(() => null);
  }

  const lines = rows.slice(0, topN).map((r, i) => {
    const medal    = medals[i] ?? `\`${String(i + 1).padStart(2)}.\``;
    const gMember  = guild?.members?.cache?.get(r.user_id);
    const name     = gMember?.displayName ?? `<@${r.user_id}>`;
    const phong    = r.phong_ban ?? '';
    const joined   = r.total_joined   ?? 0;
    const streak   = r.current_streak ?? 0;
    const totalS   = r.total_sessions ?? joined;
    const pct      = totalS > 0 ? Math.round((joined / totalS) * 100) : 0;
    const phongStr = phong ? ` · 📌 ${phong}` : '';
    const phaiStr  = formatPhaiList(r.phai_role_ids, guild, cfg?.phai_role_icons);
    const phaiLine = phaiStr ? ` · ${phaiStr}` : '';
    return `${medal} **${name}**${phongStr}${phaiLine}\n\`${buildRichProgressBar(pct, 8)}\` **${pct}%** · ${joined} phiên · ${ICONS.FIRE}${streak}`;
  });

  const components = [];

  // Phòng ban filter select menu
  if (phongBanList.length > 0) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(CUSTOM_ID.PHONG_BAN_SELECT)
      .setPlaceholder('Lọc theo phòng ban')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Tất cả')
          .setValue('__all')
          .setDefault(selectedPhongBan === ''),
        ...phongBanList.map(pb => new StringSelectMenuOptionBuilder()
          .setLabel(pb)
          .setValue(pb)
          .setDefault(selectedPhongBan === pb)
        )
      );
    components.push(new ActionRowBuilder().addComponents(selectMenu));
  }

  // Phái filter buttons
  const phaiIds = cfg?.phai_role_ids ?? [];
  if (phaiIds.length > 0 && phaiIds.length <= 4) {
    const phaiRow = new ActionRowBuilder();
    phaiRow.addComponents(
      new ButtonBuilder()
        .setCustomId(CUSTOM_ID.RANK_ALL)
        .setLabel('Tất cả')
        .setStyle(filterPhaiRoleId ? ButtonStyle.Secondary : ButtonStyle.Primary),
    );
    for (const rid of phaiIds) {
      const icon = getPhaiIcon(rid, phaiIds, guild, cfg?.phai_role_icons);
      const role = guild?.roles?.cache?.get(rid);
      phaiRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID.RANK_PHAI_PREFIX}${rid}`)
          .setLabel(role?.name ?? rid)
          .setEmoji(icon)
          .setStyle(filterPhaiRoleId === rid ? ButtonStyle.Primary : ButtonStyle.Secondary),
      );
    }
    components.push(phaiRow);
  }

  components.push(_navRow());

  const footerParts = [];
  if (selectedPhongBan) footerParts.push(`pb:${selectedPhongBan}`);
  if (filterPhaiRoleId) footerParts.push(`phai:${filterPhaiRoleId}`);
  const footerExtra = footerParts.join(' · ');

  return {
    embeds: [new EmbedBuilder().setColor(COLORS.GOLD).setAuthor(buildAuthor(guild))
      .setTitle(`${ICONS.TROPHY} Top ${Math.min(rows.length, topN)} — Bảng xếp hạng`)
      .setDescription(lines.join('\n\n'))
      .setFooter({ text: _footer(CTX.RANK, footerExtra) }).setTimestamp()],
    components,
  };
}

// ─── Lịch sử cá nhân ─────────────────────────────────────────────────
async function renderLichSu(records, userId, guild, page = 0) {
  const safeRecords = Array.isArray(records) ? records : [];
  const PAGE_SIZE  = 10;
  const total      = safeRecords.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cPage      = Math.max(0, Math.min(page, totalPages - 1));
  const start      = cPage * PAGE_SIZE;
  const slice      = safeRecords.slice(start, start + PAGE_SIZE);

  if (!guild?.members?.cache?.has(userId) && guild) {
    try { await guild.members.fetch(userId); } catch { /* not in guild */ }
  }
  const gMember = guild?.members?.cache?.get(userId);
  const name    = gMember?.displayName ?? `<@${userId}>`;

  const statusMap = {
    tham_gia:       { emoji: ICONS.ATTEND_YES    ?? '✅', label: 'Tham gia' },
    tre:            { emoji: ICONS.ATTEND_LATE   ?? '⏰', label: 'Trễ'     },
    khong_tham_gia: { emoji: ICONS.ATTEND_NO     ?? '❌', label: 'Vắng'    },
    co_phep:        { emoji: ICONS.ATTEND_EXCUSE ?? '📋', label: 'Có phép' },
  };

  if (!total) {
    return {
      embeds: [new EmbedBuilder().setColor(COLORS.NEUTRAL).setAuthor(buildAuthor(guild)).setTitle(`📋 Lịch sử — ${name}`)
        .setDescription('> _Chưa có điểm danh nào._')
        // [FIX] encode uid để REFRESH và pagination đọc đúng người
        .setFooter({ text: _footer(CTX.LICHSU, `uid:${userId}`) }).setTimestamp()],
      components: [_navRow()],
    };
  }

  // Tóm tắt trạng thái toàn bộ records
  const summary = { tham_gia: 0, tre: 0, khong_tham_gia: 0, co_phep: 0 };
  for (const r of safeRecords) {
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

  // navRow: prev/next + REFRESH + BACK_HOME
  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:stats:lichsu:prev').setLabel('◀ Trước').setStyle(ButtonStyle.Secondary).setDisabled(cPage === 0),
    new ButtonBuilder().setCustomId('setup:stats:lichsu:next').setLabel('Sau ▶').setStyle(ButtonStyle.Secondary).setDisabled(cPage >= totalPages - 1),
    new ButtonBuilder().setCustomId(CUSTOM_ID.REFRESH).setLabel('Làm mới').setEmoji(ICONS.REFRESH).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.BACK_HOME).setLabel('← Dashboard').setEmoji(ICONS.HOME).setStyle(ButtonStyle.Secondary),
  );

  // [FIX] Footer encode ctx:lichsu + uid + trang để REFRESH & pagination đọc đúng người và view
  const footerText = _footer(CTX.LICHSU, `uid:${userId} · Trang ${cPage + 1}/${totalPages} · Tổng ${total} lần`);

  return {
    embeds: [new EmbedBuilder().setColor(COLORS.NEUTRAL).setAuthor(buildAuthor(guild))
      .setTitle(`📋 Lịch sử — ${name}`)
      .setDescription(`${summaryStr}\n\n${lines.join('\n')}`)
      .setFooter({ text: footerText })
      .setTimestamp()],
    components: [navRow],
  };
}

// ─── Thống kê server ─────────────────────────────────────────────────
const PERIOD_LABELS = {
  week:  'Tuần này',
  month: 'Tháng này',
  all:   'Tất cả',
};

/**
 * @param {object} stats         — kết quả từ getServerStats()
 * @param {Array}  top           — mảng từ getTopMembers()
 * @param {object} guild         — Guild object
 * @param {string} [period=all]  — 'week' | 'month' | 'all'
 */
async function renderServerStats(stats, top, guild, period = 'all') {
  const pct      = stats?.rate_present      ?? 0;
  const total    = stats?.total_sessions    ?? 0;
  const members  = stats?.total_members     ?? 0;
  const attends  = stats?.total_attendances ?? 0;

  const nPresent = stats?.total_present  ?? null;
  const nLate    = stats?.total_late     ?? null;
  const nAbsent  = stats?.total_absent   ?? null;
  const nExcused = stats?.total_excused  ?? null;
  const rLate    = stats?.rate_late      ?? null;
  const rAbsent  = stats?.rate_absent    ?? null;
  const rExcused = stats?.rate_excused   ?? null;

  const color = pct >= 80 ? COLORS.GREEN : pct >= 50 ? COLORS.YELLOW : COLORS.RED;

  const periodLabel = PERIOD_LABELS[period] ?? 'Tất cả';
  const titleSuffix = period === 'all' ? '' : ` (${periodLabel})`;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor(buildAuthor(guild))
    .setTitle(`${ICONS.CHART} Thống kê Server${titleSuffix}`)
    .setDescription([
      `${pctEmoji(pct)} **Tỉ lệ tham gia trung bình: ${pct}%** — ${pctLabel(pct)}`,
      `\`${buildRichProgressBar(pct)}\``,
    ].join('\n'))
    .addFields(
      { name: '📅 Tổng phiên',                 value: `**${total}** phiên`,   inline: true },
      { name: '👥 Thành viên',                  value: `**${members}** người`, inline: true },
      { name: `${ICONS.ATTEND_YES} Điểm danh`, value: `**${attends}** lượt`,  inline: true },
    )
    .setFooter({ text: _footer(CTX.SERVER, `period:${period}`) })
    .setTimestamp();

  // Breakdown chi tiết 4 trạng thái
  if (nPresent !== null || nLate !== null || nAbsent !== null || nExcused !== null) {
    const breakdownLines = [
      nPresent !== null ? `${ICONS.ATTEND_YES    ?? '✅'} Tham gia: **${nPresent}** lượt` : null,
      nLate    !== null ? `${ICONS.ATTEND_LATE   ?? '⏰'} Trễ: **${nLate}** lượt (${rLate ?? 0}%)` : null,
      nAbsent  !== null ? `${ICONS.ATTEND_NO     ?? '❌'} Vắng: **${nAbsent}** lượt (${rAbsent ?? 0}%)` : null,
      nExcused !== null ? `${ICONS.ATTEND_EXCUSE ?? '📋'} Có phép: **${nExcused}** lượt (${rExcused ?? 0}%)` : null,
    ].filter(Boolean);
    if (breakdownLines.length) {
      embed.addFields({ name: '📊 Breakdown', value: breakdownLines.join('\n'), inline: false });
    }
  }

  // Mini top-5 — fetch uncached trước khi render
  if (Array.isArray(top) && top.length > 0) {
    const uncached = top.filter(r => !guild?.members?.cache?.has(r.user_id)).map(r => r.user_id);
    if (uncached.length && guild) {
      await guild.members.fetch({ user: uncached }).catch(() => null);
    }
    const medals = ['🥇', '🥈', '🥉', '`4.`', '`5.`'];
    const lines = top.slice(0, 5).map((r, i) => {
      const nm     = guild?.members?.cache?.get(r.user_id)?.displayName ?? `<@${r.user_id}>`;
      const joined = r.total_joined   ?? 0;
      const streak = r.current_streak ?? 0;
      const totalS = r.total_sessions ?? joined;
      const pctR   = totalS > 0 ? Math.round((joined / totalS) * 100) : 0;
      return `${medals[i]} **${nm}** — **${pctR}%** · ${joined} phiên · ${ICONS.FIRE}${streak}`;
    });
    embed.addFields({ name: `${ICONS.TROPHY} Top thành viên (mọi thời gian)`, value: lines.join('\n'), inline: false });
  }

  // Period filter buttons
  const periodRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.SERVER_PERIOD_WEEK)
      .setLabel('Tuần này')
      .setStyle(period === 'week' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setEmoji('📅'),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.SERVER_PERIOD_MONTH)
      .setLabel('Tháng này')
      .setStyle(period === 'month' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setEmoji('📆'),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.SERVER_PERIOD_ALL)
      .setLabel('Tất cả')
      .setStyle(period === 'all' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setEmoji('🌐'),
  );

  return { embeds: [embed], components: [periodRow, _navRow()] };
}

// ─── Xem người khác (placeholder — thực tế mở modal) ─────────────────
function renderXemInput() {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('🔍 Xem điểm danh người khác')
    .setDescription('Nhập **User ID** hoặc **@mention** vào modal.')
    .setFooter({ text: _footer(CTX.MENU) })
    .setTimestamp();

  return { embeds: [embed], components: [_navRow()] };
}

module.exports = {
  StatsView: { renderStatsMenu, renderToi, renderRank, renderLichSu, renderServerStats, renderXemInput, CUSTOM_ID },
  BADGE_THRESHOLDS,
};
