// utils/embeds.js — Tất cả embed builders & button builders
// Phase 1: Design system thống nhất — COLORS, ICONS, helpers
// Phase 3: buildSessionEmbed & buildSummaryEmbed nâng cấp visual
// Phase 5: buildHistoryEmbed + buildMemberEmbed
// Phase 6 + F: buildServerStatsEmbed + trend sparkline
// Phase G: buildAttendanceAdminRow
// Phase I: buildClosedSessionEmbed (edit message gốc khi phiên đóng)
// Phase UX-A: buildAttendanceButtons thêm nút Làm Mới
// Phase UX-B: resolveDisplayName — dùng guild.members.cache
// Phase UX-C: buildSummaryEmbed thêm phái breakdown
// Phase UX-D: buildLichEmbed — hiển thị lịch cố định
// Fix K: buildClosedSessionEmbed thêm guild + danh sách tham gia/trễ
// Fix L: buildSessionEmbed absentIds dùng resolveDisplayName
// Fix O: buildServerStatsEmbed thêm phái breakdown field
'use strict';
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

// ─── Design Tokens ────────────────────────────────────────────────────────────
const COLORS = {
  SUCCESS:   0x01696f,
  WARNING:   0xd19900,
  ERROR:     0xa12c7b,
  INFO:      0x006494,
  INACTIVE:  0x393836,
  GOLD:      0xd19900,
  PRIMARY:   0x01696f,
};

const ICONS = {
  SESSION_OPEN:   '🟢',
  SESSION_CLOSED: '🔴',
  ATTEND_YES:     '✅',
  ATTEND_LATE:    '⏰',
  ATTEND_NO:      '❌',
  ATTEND_ABSENT:  '👻',
  PERSON:         '👥',
  CLOCK:          '🕐',
  CHART_UP:       '📈',
  CHART_DOWN:     '📉',
  TREND_UP:       '📈',
  TREND_DOWN:     '📉',
  TREND_STABLE:   '➡️',
  STATS:          '📊',
  TROPHY:         '🏆',
  SWORD:          '⚔️',
  SHIELD:         '🛡️',
  PIN:            '📌',
  CALENDAR:       '📅',
  BELL:           '🔔',
  SETTINGS:       '⚙️',
  INFO:           'ℹ️',
  WARNING:        '⚠️',
  CHECK:          '✔️',
  CROSS:          '✖️',
};

const FOOTER_DEFAULT = 'Quản Gia · Bot Điểm Danh';
const AUTHOR_DEFAULT = { name: `${ICONS.BELL} Quản Gia · Bot Điểm Danh` };

// ─── Reply helpers ────────────────────────────────────────────────────────────
const replyOk      = (content) => ({ content: `✅ ${content}`, ephemeral: true });
const replyErr     = (content) => ({ content: `❌ ${content}`, ephemeral: true });
const replyWarn    = (content) => ({ content: `⚠️ ${content}`, ephemeral: true });
const replyInfo    = (content) => ({ content: `ℹ️ ${content}`, ephemeral: true });
const replyOkEdit  = (content) => ({ content: `✅ ${content}` });
const replyErrEdit = (content) => ({ content: `❌ ${content}` });
const replyWarnEdit= (content) => ({ content: `⚠️ ${content}` });
const replyInfoEdit= (content) => ({ content: `ℹ️ ${content}` });
const replyLoading = (content) => ({ content: `⏳ ${content}`, ephemeral: true });

function replyConfirm(message, confirmId, cancelId) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(confirmId).setLabel('Xác nhận').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(cancelId).setLabel('Hủy').setStyle(ButtonStyle.Secondary),
  );
  return { content: message, components: [row], ephemeral: true };
}

// ─── Color / emoji helpers ────────────────────────────────────────────────────
function pctColor(pct) {
  if (pct >= 80) return COLORS.SUCCESS;
  if (pct >= 60) return COLORS.WARNING;
  if (pct >= 40) return COLORS.INFO;
  return COLORS.ERROR;
}

function pctEmoji(pct) {
  if (pct >= 90) return '🏆';
  if (pct >= 75) return '🥇';
  if (pct >= 60) return '🥈';
  if (pct >= 40) return '🥉';
  return '📉';
}

function pctLabel(pct) {
  if (pct >= 90) return 'Xuất sắc';
  if (pct >= 75) return 'Tốt';
  if (pct >= 60) return 'Khá';
  if (pct >= 40) return 'Trung bình';
  return 'Thấp';
}

// ─── chunkLines: tách mảng dòng thành chunks ≤ 1024 ký tự ────────────────────
function chunkLines(lines, maxLen = 1024) {
  const chunks = [];
  let cur = '';
  for (const line of lines) {
    const next = cur ? cur + '\n' + line : line;
    if (next.length > maxLen) {
      if (cur) chunks.push(cur);
      cur = line;
    } else {
      cur = next;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}g ${m}p`;
  if (h > 0) return `${h} giờ`;
  if (m > 0) return `${m} phút`;
  return `${seconds % 60} giây`;
}

function buildRichProgressBar(pct, len = 12) {
  const clamped = Math.min(100, Math.max(0, pct));
  const filled  = Math.round((clamped / 100) * len);
  const bar     = '▰'.repeat(filled) + '▱'.repeat(len - filled);
  return `${bar} **${clamped}%**`;
}

// Phase UX-B: resolve display name từ guild cache
function resolveDisplayName(guild, userId, fallback) {
  if (!guild) return fallback ?? `<@${userId}>`;
  const member = guild.members.cache.get(userId);
  return member?.displayName ?? fallback ?? `<@${userId}>`;
}

// ─── Thống kê phái helper ──────────────────────────────────────────────────────
function buildPhaiStatsText(guild, phaiRoleIds, attended, eligible) {
  if (!guild || !phaiRoleIds?.length) return null;

  const presentSet  = new Set(
    (attended ?? []).filter(a => a.status === 'tham_gia' || a.status === 'tre').map(a => a.user_id)
  );

  const lines = [];
  for (const roleId of phaiRoleIds) {
    const role = guild.roles.cache.get(roleId);
    if (!role) continue;
    const members  = role.members;
    const total    = members.size;
    if (total === 0) continue;
    const present  = members.filter(m => presentSet.has(m.id)).size;
    const pct      = Math.round((present / total) * 100);
    const bar      = buildRichProgressBar(pct, 8);
    lines.push(`**${role.name}** ${bar}  \`${present}/${total}\``);
  }
  return lines.length ? lines.join('\n') : null;
}

// ─── Attendance Buttons ───────────────────────────────────────────────────────
function buildAttendanceButtons(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('attend_yes')
      .setLabel('Tham Gia')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('attend_late')
      .setLabel('Đến Trễ')
      .setEmoji('⏰')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('attend_no')
      .setLabel('Không Tham Gia')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('attend_refresh')
      .setLabel('Làm Mới')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
  );
}

// Phase G: Admin row
function buildAttendanceAdminRow(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('attend_view')
      .setLabel('Xem DS')
      .setEmoji('📋')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('attend_close')
      .setLabel('Đóng Phiên')
      .setEmoji('🔐')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('admin:override')
      .setLabel('Override')
      .setEmoji('⚙️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
  );
}

// ─── buildSessionEmbed ────────────────────────────────────────────────────────
async function buildSessionEmbed(guild, session, attended, phaiRoleIds = null) {
  const joined       = attended.filter(a => a.status === 'tham_gia');
  const late         = attended.filter(a => a.status === 'tre');
  const declined     = attended.filter(a => a.status === 'khong_tham_gia');
  const eligible     = session.eligible_member_ids.length;
  const presentCount = joined.length + late.length;
  const pct          = eligible > 0 ? Math.round((presentCount / eligible) * 100) : 0;

  const checkedIds = new Set(attended.map(a => a.user_id));
  const absentIds  = session.eligible_member_ids.filter(id => !checkedIds.has(id));

  const startedAt = session.created_at ?? session.started_at;
  const startTs   = Math.floor(new Date(startedAt).getTime() / 1000);

  const roleDisplay = session.allowed_role_id
    ? `<@&${session.allowed_role_id}>`
    : (session.role_name ?? 'Tất cả');

  const statusLine = `${ICONS.SESSION_OPEN} **Đang mở** · ${roleDisplay} · ${eligible} thành viên`;
  const richBar    = buildRichProgressBar(pct);
  const statsLine  = `${richBar} · ${ICONS.ATTEND_YES}\`${joined.length}\` ${ICONS.ATTEND_LATE}\`${late.length}\` ${ICONS.ATTEND_NO}\`${declined.length}\``;

  const timeLines = [`${ICONS.CLOCK} Bắt đầu: <t:${startTs}:f> (<t:${startTs}:R>)`];
  if (session.auto_close_at) {
    const ts = Math.floor(new Date(session.auto_close_at).getTime() / 1000);
    timeLines.push(`${ICONS.SESSION_CLOSED} Tự đóng: <t:${ts}:f> (<t:${ts}:R>)`);
  }

  const embed = new EmbedBuilder()
    .setAuthor({ name: `${ICONS.SESSION_OPEN} Quản Gia · Điểm Danh` })
    .setTitle(`${session.session_name}`)
    .setColor(COLORS.SUCCESS)
    .setDescription([
      statusLine,
      '',
      statsLine,
      '',
      ...timeLines,
    ].join('\n'))
    .setTimestamp();

  if (guild?.iconURL) {
    const iconURL = guild.iconURL({ dynamic: true });
    if (iconURL) embed.setThumbnail(iconURL);
  }

  // Phase UX-B: dùng displayName thay username
  if (joined.length > 0)
    chunkLines(joined.map((a, i) => `\`${String(i + 1).padStart(2)}.\` **${resolveDisplayName(guild, a.user_id, a.username)}**`))
      .forEach((chunk, i) => embed.addFields({
        name: i === 0 ? `${ICONS.ATTEND_YES} Tham Gia — ${joined.length}` : '\u200b',
        value: chunk, inline: true,
      }));

  if (late.length > 0)
    chunkLines(late.map((a, i) => `\`${String(i + 1).padStart(2)}.\` ${resolveDisplayName(guild, a.user_id, a.username)}`))
      .forEach((chunk, i) => embed.addFields({
        name: i === 0 ? `${ICONS.ATTEND_LATE} Đến Trễ — ${late.length}` : '\u200b',
        value: chunk, inline: true,
      }));

  if (declined.length > 0)
    chunkLines(declined.map((a, i) => `\`${String(i + 1).padStart(2)}.\` ~~${resolveDisplayName(guild, a.user_id, a.username)}~~`))
      .forEach((chunk, i) => embed.addFields({
        name: i === 0 ? `${ICONS.ATTEND_NO} Vắng Mặt — ${declined.length}` : '\u200b',
        value: chunk, inline: true,
      }));

  // Fix L: absentIds dùng resolveDisplayName thay <@id> mention
  if (absentIds.length > 0) {
    const MAX   = 25;
    const names = absentIds.slice(0, MAX)
      .map((id, i) => `\`${String(i + 1).padStart(2)}.\` ${resolveDisplayName(guild, id, `<@${id}>`)}`);
    const extra = absentIds.length > MAX ? `\n*(+${absentIds.length - MAX} nữa)*` : '';
    chunkLines(names).slice(0, 1).forEach(chunk =>
      embed.addFields({
        name:  `${ICONS.ATTEND_ABSENT} Chưa Điểm Danh (${absentIds.length})`,
        value: chunk + extra, inline: false,
      })
    );
  }

  const phaiText = buildPhaiStatsText(guild, phaiRoleIds, attended, session.eligible_member_ids);
  if (phaiText)
    embed.addFields({ name: `${ICONS.SWORD} Thống Kê Phái`, value: phaiText, inline: false });

  embed.setFooter({ text: `${FOOTER_DEFAULT} · Bấm nút bên dưới để điểm danh · 🔄 Làm Mới để cập nhật` });
  return embed;
}

// ─── Phase I: buildClosedEmbed — embed khi phiên đã đóng ──────────────────────
/**
 * Fix K: Thêm guild param để render danh sách tham gia/trễ.
 * Trả về embed dạng "🔴 Đã Đóng" để edit vào message gốc khi phiên kết thúc.
 */
function buildClosedSessionEmbed(session, attended, guild = null) {
  const joined       = (attended ?? []).filter(a => a.status === 'tham_gia');
  const late         = (attended ?? []).filter(a => a.status === 'tre');
  const eligible     = (session.eligible_member_ids ?? []).length;
  const presentCount = joined.length + late.length;
  const pct          = eligible > 0 ? Math.round((presentCount / eligible) * 100) : 0;
  const richBar      = buildRichProgressBar(pct);

  const startedAt = session.created_at ?? session.started_at;
  const startTs   = startedAt ? Math.floor(new Date(startedAt).getTime() / 1000) : null;
  const endTs     = session.ended_at ? Math.floor(new Date(session.ended_at).getTime() / 1000) : Math.floor(Date.now() / 1000);

  const embed = new EmbedBuilder()
    .setAuthor({ name: `${ICONS.SESSION_CLOSED} Quản Gia · Điểm Danh` })
    .setTitle(`🔴 Đã Đóng · ${session.session_name}`)
    .setColor(COLORS.INACTIVE)
    .setDescription([
      `${ICONS.SESSION_CLOSED} **Phiên đã kết thúc**`,
      '',
      richBar,
      `> ${ICONS.ATTEND_YES} \`${joined.length} tham gia\`  ${ICONS.ATTEND_LATE} \`${late.length} trễ\`  ${ICONS.PERSON} \`${eligible} thành viên\``,
      '',
      startTs ? `${ICONS.CLOCK} <t:${startTs}:f>  →  <t:${endTs}:f>` : `${ICONS.CLOCK} Đóng lúc <t:${endTs}:f>`,
    ].join('\n'))
    .setFooter({ text: `${FOOTER_DEFAULT} · Phiên đã đóng · Không thể điểm danh` })
    .setTimestamp();

  // Fix K: Danh sách tham gia & đến trễ
  if (joined.length > 0)
    chunkLines(joined.map((a, i) => `\`${String(i + 1).padStart(2)}.\` **${resolveDisplayName(guild, a.user_id, a.username)}**`))
      .forEach((chunk, i) => embed.addFields({
        name: i === 0 ? `${ICONS.ATTEND_YES} Tham Gia — ${joined.length}` : '\u200b',
        value: chunk, inline: true,
      }));

  if (late.length > 0)
    chunkLines(late.map((a, i) => `\`${String(i + 1).padStart(2)}.\` ${resolveDisplayName(guild, a.user_id, a.username)}`))
      .forEach((chunk, i) => embed.addFields({
        name: i === 0 ? `${ICONS.ATTEND_LATE} Đến Trễ — ${late.length}` : '\u200b',
        value: chunk, inline: true,
      }));

  return embed;
}

// ─── Phase 3 + UX-B + UX-C: Summary Embed ────────────────────────────────────
function buildSummaryEmbed(session, attended, guild = null, phaiRoleIds = null) {
  const joined       = attended.filter(a => a.status === 'tham_gia');
  const late         = attended.filter(a => a.status === 'tre');
  const declined     = attended.filter(a => a.status === 'khong_tham_gia');
  const eligible     = session.eligible_member_ids.length;
  const presentCount = joined.length + late.length;
  const pct          = eligible > 0 ? Math.round((presentCount / eligible) * 100) : 0;

  const startedAt = session.created_at ?? session.started_at;
  const startTs   = Math.floor(new Date(startedAt).getTime() / 1000);
  const endTs     = session.ended_at ? Math.floor(new Date(session.ended_at).getTime() / 1000) : null;
  const dur       = endTs ? formatDuration(endTs - startTs) : null;

  const badge = pct >= 90 ? '🏆 Xuất sắc' : pct >= 80 ? '🥇 Tốt' : pct >= 60 ? '🥈 Khá' : pct >= 40 ? '🥉 TB' : '📉 Thấp';
  const richBar  = buildRichProgressBar(pct);

  const descLines = [
    `${pctEmoji(pct)} **${pct}%** — ${badge}`,
    `${richBar}`,
    '',
    `> ${ICONS.ATTEND_YES} \`${joined.length} tham gia\`  ${ICONS.ATTEND_LATE} \`${late.length} trễ\`  ${ICONS.ATTEND_NO} \`${declined.length} vắng\`  ${ICONS.PERSON} \`${eligible} thành viên\``,
    '',
    `${ICONS.CLOCK} <t:${startTs}:f>${endTs ? `  →  <t:${endTs}:f>` : ''}${dur ? `  ·  ⏱ **${dur}**` : ''}`,
  ];

  const embed = new EmbedBuilder()
    .setAuthor({ name: `${ICONS.SESSION_CLOSED} Quản Gia · Tổng Kết Điểm Danh` })
    .setTitle(`📋 ${session.session_name}`)
    .setColor(pctColor(pct))
    .setDescription(descLines.join('\n'))
    .setTimestamp();

  const joinedLines = joined.map((a, i) => `\`${String(i + 1).padStart(2)}.\` **${resolveDisplayName(guild, a.user_id, a.username)}**`);
  const lateLines   = late.map((a, i)   => `\`${String(i + 1).padStart(2)}.\` ${resolveDisplayName(guild, a.user_id, a.username)}`);
  const decLines    = declined.map((a, i) => `\`${String(i + 1).padStart(2)}.\` ~~${resolveDisplayName(guild, a.user_id, a.username)}~~`);

  if (joinedLines.length > 0)
    chunkLines(joinedLines).forEach((chunk, i) => embed.addFields({
      name: i === 0 ? `${ICONS.ATTEND_YES} Tham Gia — ${joined.length}` : '\u200b',
      value: chunk, inline: true,
    }));

  if (lateLines.length > 0)
    chunkLines(lateLines).forEach((chunk, i) => embed.addFields({
      name: i === 0 ? `${ICONS.ATTEND_LATE} Đến Trễ — ${late.length}` : '\u200b',
      value: chunk, inline: true,
    }));

  if (decLines.length > 0)
    chunkLines(decLines).forEach((chunk, i) => embed.addFields({
      name: i === 0 ? `${ICONS.ATTEND_NO} Vắng Có Phép — ${declined.length}` : '\u200b',
      value: chunk, inline: true,
    }));

  const absentIds2 = session.eligible_member_ids.filter(
    id => !new Set(attended.map(a => a.user_id)).has(id)
  );
  if (absentIds2.length > 0) {
    const MAX2  = 25;
    const names2 = absentIds2.slice(0, MAX2)
      .map((id, i) => `\`${String(i + 1).padStart(2)}.\` ${resolveDisplayName(guild, id, `<@${id}>`)}`);
    const extra2 = absentIds2.length > MAX2 ? `\n*(+${absentIds2.length - MAX2} nữa)*` : '';
    chunkLines(names2).slice(0, 1).forEach(chunk =>
      embed.addFields({
        name: `${ICONS.ATTEND_ABSENT} Vắng Mặt (${absentIds2.length})`,
        value: chunk + extra2, inline: false,
      })
    );
  }

  const phaiText2 = buildPhaiStatsText(guild, phaiRoleIds,
    attended,
    session.eligible_member_ids.map(id => ({ id }))
  );
  if (phaiText2)
    embed.addFields({ name: `${ICONS.SWORD} Thống Kê Phái`, value: phaiText2, inline: false });

  embed.setFooter({ text: FOOTER_DEFAULT }).setTimestamp();
  return embed;
}

// ─── Phase 5: History Embed ───────────────────────────────────────────────────
function buildHistoryEmbed(sessions, guild, page = 1, pageSize = 5, total = null) {
  const totalPages = Math.ceil((total ?? sessions.length) / pageSize);
  const embed = new EmbedBuilder()
    .setAuthor({ name: `${ICONS.CALENDAR} Quản Gia · Lịch Sử Điểm Danh` })
    .setTitle(`📜 Lịch Sử — ${guild.name}`)
    .setColor(COLORS.INFO)
    .setFooter({ text: `${FOOTER_DEFAULT} · Trang ${page}/${totalPages}` })
    .setTimestamp();

  if (!sessions.length) {
    embed.setDescription('_Chưa có phiên điểm danh nào._');
    return embed;
  }

  for (const s of sessions) {
    const startedAt = s.created_at ?? s.started_at;
    const ts  = Math.floor(new Date(startedAt).getTime() / 1000);
    const elig = (s.eligible_member_ids ?? []).length;
    const att  = s.attended_count ?? 0;
    const pct2 = elig > 0 ? Math.round((att / elig) * 100) : 0;
    embed.addFields({
      name:  `${pctEmoji(pct2)} ${s.session_name}`,
      value: `<t:${ts}:d>  ·  ${att}/${elig}  ·  **${pct2}%**`,
      inline: false,
    });
  }
  return embed;
}

// ─── Phase 5: Member Embed ────────────────────────────────────────────────────
function buildMemberEmbed(guild, userId, stats, badges = []) {
  const displayName = resolveDisplayName(guild, userId, `<@${userId}>`);
  const total   = stats?.total_joined    ?? 0;
  const streak  = stats?.current_streak  ?? 0;
  const maxS    = stats?.max_streak      ?? 0;

  const embed = new EmbedBuilder()
    .setAuthor({ name: `${ICONS.PERSON} Quản Gia · Thống Kê Thành Viên` })
    .setTitle(displayName)
    .setColor(pctColor(total > 0 ? Math.min(100, total) : 0))
    .addFields(
      { name: `${ICONS.ATTEND_YES} Tổng điểm danh`, value: `**${total}** lần`, inline: true },
      { name: `🔥 Streak hiện tại`,                 value: `**${streak}** phiên`, inline: true },
      { name: `🏅 Streak tối đa`,                   value: `**${maxS}** phiên`, inline: true },
    )
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  if (badges.length > 0) {
    const badgeLines = badges.map(b => `${b.emoji} **${b.label}** *(≥${b.threshold} lần)*`).join('\n');
    embed.addFields({ name: '🎖️ Huy Hiệu', value: badgeLines, inline: false });
  }
  return embed;
}

// ─── Phase 4: Config Embed ────────────────────────────────────────────────────
function buildConfigEmbed(guild, cfg) {
  const adminRole   = cfg?.admin_role_id   ? `<@&${cfg.admin_role_id}>`   : '_Chưa đặt_';
  const attendRole  = cfg?.attend_role_id  ? `<@&${cfg.attend_role_id}>`  : '_Tất cả_';
  const channelDisp = cfg?.channel_id      ? `<#${cfg.channel_id}>`       : '_Chưa đặt_';
  const logChan     = cfg?.log_channel_id  ? `<#${cfg.log_channel_id}>`   : '_Chưa đặt_';

  return new EmbedBuilder()
    .setAuthor({ name: `${ICONS.SETTINGS} Quản Gia · Cấu Hình Server` })
    .setTitle(`⚙️ Cấu Hình: ${guild.name}`)
    .setColor(COLORS.INFO)
    .addFields(
      { name: '🛡️ Role Admin',        value: adminRole,   inline: true },
      { name: '👥 Role Điểm Danh',    value: attendRole,  inline: true },
      { name: '📢 Kênh Điểm Danh',   value: channelDisp, inline: true },
      { name: '📋 Kênh Log',          value: logChan,     inline: true },
    )
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();
}

// ─── Phase 6 + F: Server Stats Embed với trend sparkline ─────────────────────
/**
 * Fix O: thêm phái breakdown field từ stats.phaiRoleIds + stats.allAttended
 */
function buildServerStatsEmbed(guild, stats, topMembers, topLimit = 10, recentSessions = null) {
  const {
    totalSessions, totalMembers, avgAttendance,
    overallPct, lastSession, activeSession, periodLabel,
  } = stats;

  const richBar  = buildRichProgressBar(overallPct);
  const badge    = overallPct >= 90 ? '🏆 Xuất sắc' : overallPct >= 75 ? '🥇 Tốt' : overallPct >= 55 ? '🥈 Khá' : overallPct >= 35 ? '🥉 Trung bình' : '📉 Thấp';

  let phienLine;
  if (activeSession) {
    const ts = Math.floor(new Date(activeSession.created_at).getTime() / 1000);
    phienLine = `${ICONS.SESSION_OPEN} **${activeSession.session_name}** đang mở — <t:${ts}:R>`;
  } else {
    phienLine = `⚫ Không có phiên đang mở`;
  }

  let lastLine = '_Chưa có phiên nào_';
  if (lastSession) {
    const startedAt = lastSession.created_at ?? lastSession.started_at;
    const ts = Math.floor(new Date(startedAt).getTime() / 1000);
    const attended = (lastSession.attended_count ?? 0);
    const eligible = (lastSession.eligible_member_ids ?? []).length;
    const lPct     = eligible > 0 ? Math.round((attended / eligible) * 100) : 0;
    lastLine = `**${lastSession.session_name}** — <t:${ts}:d>  ·  ${lPct}% (${attended}/${eligible})`;
  }

  const topLines = topMembers.length > 0
    ? topMembers.slice(0, topLimit).map((m, i) => {
        const medals = ['🥇','🥈','🥉'];
        const medal  = medals[i] ?? `\`${i + 1}.\``;
        const mPct   = m.total_sessions > 0 ? Math.round((m.total_joined / m.total_sessions) * 100) : 0;
        return `${medal} <@${m.user_id}> — **${m.total_joined}** phiên *(${mPct}%)*`;
      }).join('\n')
    : '_Chưa có dữ liệu_';

  const embed = new EmbedBuilder()
    .setAuthor({ name: `${ICONS.STATS} Quản Gia · Thống Kê Server` })
    .setTitle(`📊 Thống Kê: ${guild.name}`)
    .setColor(pctColor(overallPct))
    .setDescription([
      `${pctEmoji(overallPct)} Tỷ lệ điểm danh tổng: **${overallPct}%** — ${badge}`,
      richBar,
    ].join('\n'))
    .addFields(
      {
        name: `${ICONS.CHART_UP} Tổng quan`,
        value: [
          `▸ Kỳ: **${periodLabel ?? 'Tất cả'}**`,
          `▸ Tổng phiên: **${totalSessions}**`,
          `▸ Thành viên theo dõi: **${totalMembers}**`,
          `▸ Trung bình mỗi người: **${avgAttendance}** phiên`,
        ].join('\n'),
        inline: false,
      },
      { name: `${ICONS.PIN} Phiên hiện tại`, value: phienLine,  inline: false },
      { name: `${ICONS.CLOCK} Phiên gần nhất`, value: lastLine, inline: false },
    );

  // Phase F: Trend sparkline 5 phiên gần nhất
  if (recentSessions && recentSessions.length >= 2) {
    const pcts = recentSessions.map(s => {
      const eligible = (s.eligible_member_ids ?? []).length;
      const present  = s.attended_count ?? 0;
      return eligible > 0 ? Math.round((present / eligible) * 100) : 0;
    });

    const SPARK = ['▁','▂','▃','▄','▅','▆','▇','█'];
    const maxP  = Math.max(...pcts);
    const minP  = Math.min(...pcts);
    const range = maxP - minP || 1;
    const sparkline = pcts.map(p => {
      const idx = Math.round(((p - minP) / range) * (SPARK.length - 1));
      return SPARK[idx];
    }).join('');

    const recent2 = (pcts[0] + pcts[1]) / 2;
    const older2  = pcts.length >= 4 ? (pcts[pcts.length - 2] + pcts[pcts.length - 1]) / 2 : (pcts[pcts.length - 1]);
    const diff    = recent2 - older2;
    const trendLabel = diff > 3  ? `${ICONS.TREND_UP} Đang cải thiện (+${Math.round(diff)}%)`
                     : diff < -3 ? `${ICONS.TREND_DOWN} Đang giảm (${Math.round(diff)}%)`
                                 : `${ICONS.TREND_STABLE} Ổn định`;

    const sparkLine  = `\`${sparkline}\`  ${pcts.map(p => `**${p}%**`).join(' → ')}`;

    embed.addFields({
      name:  `${ICONS.CHART_UP} Xu hướng ${pcts.length} phiên gần nhất`,
      value: `${sparkLine}\n${trendLabel}`,
      inline: false,
    });
  }

  // Fix O: Phái breakdown
  if (stats.phaiRoleIds?.length && stats.allAttended?.length) {
    const phaiText = buildPhaiStatsText(guild, stats.phaiRoleIds, stats.allAttended, stats.totalMembers);
    if (phaiText)
      embed.addFields({ name: `${ICONS.SWORD} Thống Kê Phái`, value: phaiText, inline: false });
  }

  embed.addFields({ name: `${ICONS.TROPHY} Top điểm danh (Top ${topLimit})`, value: topLines, inline: false });

  if (guild.iconURL) {
    const url = guild.iconURL({ dynamic: true });
    if (url) embed.setThumbnail(url);
  }

  embed
    .setFooter({ text: `${FOOTER_DEFAULT} · ${periodLabel ?? 'Tất cả'} · ${totalSessions} phiên · ${totalMembers} thành viên` })
    .setTimestamp();

  return embed;
}

// ─── Phase UX-D: Lịch Cố Định Embed ─────────────────────────────────────────
function buildLichEmbed(danhSach, guild) {
  const TZ = 7 * 60 * 60;

  if (!danhSach || danhSach.length === 0) {
    return new EmbedBuilder()
      .setAuthor(AUTHOR_DEFAULT)
      .setTitle(`${ICONS.CALENDAR} Lịch Cố Định`)
      .setColor(COLORS.INACTIVE)
      .setDescription('> Chưa có lịch nào được thiết lập.\n> Dùng `/setup_lich` để thêm lịch mới.')
      .setFooter({ text: FOOTER_DEFAULT });
  }

  function nextWeekdayUnix(dayOfWeek, hour, minute, afterUnix = null) {
    const nowDate = new Date(Date.now());
    const vnNow   = new Date(nowDate.getTime() + TZ * 1000);
    const curDay  = vnNow.getUTCDay();
    const curH    = vnNow.getUTCHours();
    const curM    = vnNow.getUTCMinutes();

    let daysUntil = (dayOfWeek - curDay + 7) % 7;
    if (afterUnix) {
      const afterDate = new Date(afterUnix * 1000);
      const afterVn   = new Date(afterDate.getTime() + TZ * 1000);
      let baseDays    = (dayOfWeek - afterVn.getUTCDay() + 7) % 7;
      const afterH    = afterVn.getUTCHours();
      const afterM    = afterVn.getUTCMinutes();
      if (baseDays === 0 && (hour * 60 + minute) <= (afterH * 60 + afterM)) baseDays = 7;
      const base = new Date(afterDate);
      base.setUTCHours(0, 0, 0, 0);
      const closeDate = new Date(base.getTime() + (baseDays * 86400 + hour * 3600 + minute * 60) * 1000 - TZ * 1000);
      return Math.floor(closeDate.getTime() / 1000);
    }

    if (daysUntil === 0) {
      const curMins  = curH * 60 + curM;
      const slotMins = hour * 60 + minute;
      if (curMins >= slotMins) daysUntil = 7;
    }

    const base = new Date(nowDate);
    base.setUTCHours(0, 0, 0, 0);
    const vnBase = new Date(base.getTime() - TZ * 1000);
    const utcBase = new Date(vnBase.getTime() + vnNow.getUTCHours() * 3600000 + vnNow.getUTCMinutes() * 60000 + vnNow.getUTCSeconds() * 1000);
    const startOfVnDay = new Date(nowDate.getTime() - (curH * 3600 + curM * 60 + vnNow.getUTCSeconds()) * 1000);
    const targetDate   = new Date(startOfVnDay.getTime() + (daysUntil * 86400 + hour * 3600 + minute * 60) * 1000 - TZ * 1000);
    return Math.floor(targetDate.getTime() / 1000);
  }

  const TEN_THU_FULL = ['Chủ Nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];

  const lines = danhSach.map(lich => {
    const openTs  = nextWeekdayUnix(lich.day_of_week, lich.open_hour,  lich.open_minute);
    const closeTs = nextWeekdayUnix(lich.day_of_week, lich.close_hour, lich.close_minute, openTs);
    const tenThu  = TEN_THU_FULL[lich.day_of_week] ?? `Thứ ${lich.day_of_week}`;
    const role    = lich.role_id ? `<@&${lich.role_id}>` : 'Tất cả';
    return [
      `### ${ICONS.CALENDAR} ${tenThu} — ${role}`,
      `${ICONS.CLOCK} Mở: <t:${openTs}:F>  (<t:${openTs}:R>)`,
      `${ICONS.SESSION_CLOSED} Đóng: <t:${closeTs}:F>  (<t:${closeTs}:R>)`,
    ].join('\n');
  });

  return new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle(`${ICONS.CALENDAR} Lịch Cố Định — ${guild?.name ?? 'Server'}`)
    .setColor(COLORS.PRIMARY)
    .setDescription(lines.join('\n\n'))
    .setFooter({ text: `${FOOTER_DEFAULT} · Bot sẽ tự mở/đóng theo lịch` })
    .setTimestamp();
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  COLORS, ICONS,
  replyOk, replyErr, replyWarn, replyInfo,
  replyOkEdit, replyErrEdit, replyWarnEdit, replyInfoEdit,
  replyLoading,
  replyConfirm,
  pctColor, pctEmoji, pctLabel, chunkLines, formatDuration,
  buildRichProgressBar,
  resolveDisplayName,
  FOOTER_DEFAULT, AUTHOR_DEFAULT,
  buildPhaiStatsText,
  buildAttendanceButtons,
  buildAttendanceAdminRow,
  buildClosedSessionEmbed,
  buildSessionEmbed,
  buildSummaryEmbed,
  buildHistoryEmbed,
  buildMemberEmbed,
  buildConfigEmbed,
  buildServerStatsEmbed,
  buildLichEmbed,
};
