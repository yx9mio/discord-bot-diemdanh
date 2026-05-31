// utils/embeds.js — Tất cả embed builders & button builders
// Phase 1: Design system thống nhất — COLORS, ICONS, helpers
// Phase 3: buildSessionEmbed & buildSummaryEmbed nâng cấp visual
// Phase 5: Feedback states — replyLoading, replyOkEdit, replyErrEdit, replyConfirm
// Phase 6: buildServerStatsEmbed — topLimit param, periodLabel
// Phase UX-A: nút 🔄 Làm Mới trong buildAttendanceButtons
// Phase UX-B: display name từ guild.members.cache
// Phase UX-C: buildSummaryEmbed hiện tên người vắng
// Phase UX-D: buildLichEmbed — dashboard lịch cố định dùng Discord timestamp
// Phase E: buildHistoryEmbed + tỷ lệ điểm danh mini bar mỗi dòng
// Phase F: buildServerStatsEmbed + trend sparkline 5 phiên gần nhất
// Phase G: buildAttendanceAdminRow — row thứ 2 chỉ dành admin
'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { buildProgressBar } = require('./progress.js');

// ─── Design System: Color Palette ────────────────────────────────────────────
const COLORS = {
  PRIMARY:  0x5865F2,
  SUCCESS:  0x57F287,
  DANGER:   0xED4245,
  WARNING:  0xFEE75C,
  INACTIVE: 0xB9BBBE,
  GOLD:     0xF0B132,
  INFO:     0x4F8EF7,
};

// Legacy aliases
const COLOR_HIGH   = COLORS.SUCCESS;
const COLOR_MID    = COLORS.WARNING;
const COLOR_LOW    = COLORS.DANGER;
const COLOR_ACTIVE = COLORS.PRIMARY;
const COLOR_GREY   = COLORS.INACTIVE;
const COLOR_GOLD   = COLORS.GOLD;

// ─── Design System: Icon Set ──────────────────────────────────────────────────
const ICONS = {
  SESSION_OPEN:    '🟢',
  SESSION_CLOSED:  '🔴',
  SESSION_WARN:    '🟡',
  ATTEND_YES:      '✅',
  ATTEND_LATE:     '⏰',
  ATTEND_NO:       '❌',
  ATTEND_ABSENT:   '⏳',
  OPEN_SESSION:    '▶️',
  CLOSE_SESSION:   '⏹️',
  STATS:           '📊',
  HISTORY:         '📚',
  SETTINGS:        '⚙️',
  CALENDAR:        '📅',
  BELL:            '🔔',
  ROLE:            '🎫',
  SWORD:           '⚔️',
  TRASH:           '🗑️',
  EDIT:            '✏️',
  ADD:             '➕',
  BACK:            '←',
  FIRE:            '🔥',
  TROPHY:          '🏆',
  MEDAL:           '🏅',
  CLOCK:           '🕐',
  PERSON:          '👥',
  STREAK_ACTIVE:   '🔥',
  STREAK_NONE:     '💤',
  LOADING:         '⏳',
  PIN:             '📌',
  CHART_UP:        '📈',
  REFRESH:         '🔄',
  TREND_UP:        '▲',
  TREND_DOWN:      '▼',
  TREND_STABLE:    '→',
};

// ─── Design System: Semantic Embed Factories ──────────────────────────────────
function embedSuccess(title, description) {
  return new EmbedBuilder().setTitle(title).setColor(COLORS.SUCCESS).setDescription(description ?? null);
}
function embedDanger(title, description) {
  return new EmbedBuilder().setTitle(title).setColor(COLORS.DANGER).setDescription(description ?? null);
}
function embedWarning(title, description) {
  return new EmbedBuilder().setTitle(title).setColor(COLORS.WARNING).setDescription(description ?? null);
}
function embedInfo(title, description) {
  return new EmbedBuilder().setTitle(title).setColor(COLORS.INFO).setDescription(description ?? null);
}
function embedGray(title, description) {
  return new EmbedBuilder().setTitle(title).setColor(COLORS.INACTIVE).setDescription(description ?? null);
}

// ─── Phase 5: Reply Helpers (ephemeral feedback) ──────────────────────────────
const replyOk  = (msg) => ({ embeds: [embedSuccess('✅ Thành công', msg)],   ephemeral: true });
const replyErr = (msg) => ({ embeds: [embedDanger ('❌ Lỗi',        msg)],   ephemeral: true });
const replyWarn= (msg) => ({ embeds: [embedWarning('⚠️ Chú ý',      msg)],   ephemeral: true });
const replyInfo= (msg) => ({ embeds: [embedInfo   ('ℹ️ Thông tin',  msg)],   ephemeral: true });

const replyOkEdit  = (msg) => ({ embeds: [embedSuccess('✅ Thành công', msg)],  components: [] });
const replyErrEdit = (msg) => ({ embeds: [embedDanger ('❌ Lỗi',        msg)],  components: [] });
const replyWarnEdit= (msg) => ({ embeds: [embedWarning('⚠️ Chú ý',      msg)],  components: [] });
const replyInfoEdit= (msg) => ({ embeds: [embedInfo   ('ℹ️ Thông tin',  msg)],  components: [] });

const replyLoading = (msg = 'Đang xử lý...') => ({
  embeds: [new EmbedBuilder()
    .setTitle(`${ICONS.LOADING} Đang xử lý`)
    .setDescription(`> ${msg}`)
    .setColor(COLORS.INACTIVE)],
  components: [],
});

function replyConfirm(msg, customIdConfirm, customIdCancel = 'confirm:cancel') {
  const embed = embedWarning('⚠️ Xác nhận hành động', msg);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(customIdConfirm)
      .setLabel('✅ Xác nhận')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(customIdCancel)
      .setLabel('✖️ Hủy')
      .setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [row], ephemeral: true };
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const FOOTER_DEFAULT = 'Quản Gia';
const AUTHOR_DEFAULT = { name: '📋 Quản Gia · Điểm Danh' };

// ─── Helpers ───────────────────────────────────────────────────────────────────
function pctColor(pct) {
  if (pct >= 80) return COLORS.SUCCESS;
  if (pct >= 50) return COLORS.WARNING;
  return COLORS.DANGER;
}

function pctEmoji(pct) {
  if (pct >= 80) return ICONS.SESSION_OPEN;
  if (pct >= 50) return ICONS.SESSION_WARN;
  return ICONS.SESSION_CLOSED;
}

function pctLabel(pct) {
  if (pct >= 90) return 'Xuất sắc';
  if (pct >= 80) return 'Tốt';
  if (pct >= 60) return 'Khá';
  if (pct >= 40) return 'Trung bình';
  return 'Thấp';
}

function chunkLines(lines, maxLen = 950) {
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
    attended.filter(a => ['tham_gia', 'tre'].includes(a.status)).map(a => a.user_id)
  );
  const eligibleSet = new Set(eligible ?? []);

  const lines = [];
  for (const roleId of phaiRoleIds) {
    const role = guild.roles.cache.get(roleId);
    if (!role) continue;
    const total   = [...eligibleSet].filter(uid => guild.members.cache.get(uid)?.roles.cache.has(roleId)).length;
    if (total === 0) continue;
    const present = [...presentSet].filter(uid => guild.members.cache.get(uid)?.roles.cache.has(roleId)).length;
    const pct     = Math.round((present / total) * 100);
    const bar     = buildProgressBar(pct);
    lines.push(`<@&${roleId}> · **${present}/${total}** ${bar} ${pct}%`);
  }

  return lines.length > 0 ? lines.join('\n') : null;
}

// ─── Phase UX-A: Buttons (thêm nút Làm Mới) ──────────────────────────────────
function buildAttendanceButtons(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('attend_yes')
      .setLabel('Tham Gia')
      .setEmoji(ICONS.ATTEND_YES)
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('attend_late')
      .setLabel('Đến Trễ')
      .setEmoji(ICONS.ATTEND_LATE)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('attend_no')
      .setLabel('Vắng Mặt')
      .setEmoji(ICONS.ATTEND_NO)
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('attend_view')
      .setLabel('Xem DS')
      .setEmoji('📋')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(false),
    new ButtonBuilder()
      .setCustomId('attend_refresh')
      .setLabel('Làm Mới')
      .setEmoji(ICONS.REFRESH)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
  );
}

// ─── Phase G: Admin Override Row ──────────────────────────────────────────────
/**
 * buildAttendanceAdminRow(disabled)
 * Row thứ 2 chỉ dành cho admin: nút ✏️ Sửa Điểm Danh.
 * Render row này kèm theo buildAttendanceButtons() khi caller xác nhận user là admin.
 * @param {boolean} disabled — true khi phiên đã đóng
 */
function buildAttendanceAdminRow(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('admin:override')
      .setLabel('Sửa Điểm Danh')
      .setEmoji(ICONS.EDIT)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
  );
}

// ─── Phase 3 + UX-B: Session Embed ───────────────────────────────────────────
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

  if (absentIds.length > 0) {
    const MAX      = 25;
    const mentions = absentIds.slice(0, MAX).map(id => `<@${id}>`);
    const extra    = absentIds.length > MAX ? ` *(+${absentIds.length - MAX} nữa)*` : '';
    embed.addFields({
      name:  `${ICONS.ATTEND_ABSENT} Chưa Điểm Danh (${absentIds.length})`,
      value: mentions.join(' ') + extra, inline: false,
    });
  }

  const phaiText = buildPhaiStatsText(guild, phaiRoleIds, attended, session.eligible_member_ids);
  if (phaiText)
    embed.addFields({ name: `${ICONS.SWORD} Thống Kê Phái`, value: phaiText, inline: false });

  embed.setFooter({ text: `${FOOTER_DEFAULT} · Bấm nút bên dưới để điểm danh · 🔄 Làm Mới để cập nhật` });
  return embed;
}

// ─── Phase I: buildClosedEmbed — embed khi phiên đã đóng ──────────────────────
/**
 * Trả về embed dạng "🔴 Đã Đóng" để edit vào message gốc khi phiên kết thúc.
 * Dùng cùng với buildAttendanceButtons(true) để disable toàn bộ nút.
 */
function buildClosedSessionEmbed(session, attended) {
  const joined       = (attended ?? []).filter(a => a.status === 'tham_gia');
  const late         = (attended ?? []).filter(a => a.status === 'tre');
  const eligible     = (session.eligible_member_ids ?? []).length;
  const presentCount = joined.length + late.length;
  const pct          = eligible > 0 ? Math.round((presentCount / eligible) * 100) : 0;
  const richBar      = buildRichProgressBar(pct);

  const startedAt = session.created_at ?? session.started_at;
  const startTs   = startedAt ? Math.floor(new Date(startedAt).getTime() / 1000) : null;
  const endTs     = session.ended_at ? Math.floor(new Date(session.ended_at).getTime() / 1000) : Math.floor(Date.now() / 1000);

  return new EmbedBuilder()
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
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle(`${ICONS.STATS} Tổng Kết: ${session.session_name}`)
    .setColor(pctColor(pct))
    .setDescription(descLines.join('\n'))
    .setTimestamp();

  // Phase UX-B: dùng displayName
  const joinedLines = joined.map((a, i) => `\`${String(i + 1).padStart(2)}.\` **${resolveDisplayName(guild, a.user_id, a.username)}**`);
  const lateLines   = late.map((a, i)   => `\`${String(i + 1).padStart(2)}.\` ${resolveDisplayName(guild, a.user_id, a.username)}`);
  const decLines    = declined.map((a, i) => `\`${String(i + 1).padStart(2)}.\` ~~${resolveDisplayName(guild, a.user_id, a.username)}~~`);

  if (joinedLines.length > 0)
    chunkLines(joinedLines).forEach((chunk, i) =>
      embed.addFields({ name: i === 0 ? `${ICONS.ATTEND_YES} Tham Gia — ${joined.length}` : '\u200b', value: chunk, inline: true }));
  else
    embed.addFields({ name: `${ICONS.ATTEND_YES} Tham Gia — 0`, value: '—', inline: true });

  if (lateLines.length > 0)
    chunkLines(lateLines).forEach((chunk, i) =>
      embed.addFields({ name: i === 0 ? `${ICONS.ATTEND_LATE} Đến Trễ — ${late.length}` : '\u200b', value: chunk, inline: true }));

  if (decLines.length > 0)
    chunkLines(decLines).forEach((chunk, i) =>
      embed.addFields({ name: i === 0 ? `${ICONS.ATTEND_NO} Vắng Mặt — ${declined.length}` : '\u200b', value: chunk, inline: true }));
  else
    embed.addFields({ name: `${ICONS.ATTEND_NO} Vắng Mặt — 0`, value: '—', inline: true });

  // Phase UX-C: Danh sách vắng mặt có tên (không bấm nút)
  const presentIds = new Set(
    attended.filter(a => ['tham_gia', 'tre', 'co_phep'].includes(a.status)).map(a => a.user_id)
  );
  const absentIds = (session.eligible_member_ids ?? []).filter(id => !presentIds.has(id));
  if (absentIds.length > 0) {
    const MAX = 30;
    const names = absentIds.slice(0, MAX)
      .map(id => resolveDisplayName(guild, id, `<@${id}>`));
    const extra = absentIds.length > MAX ? `\n*(+${absentIds.length - MAX} nữa)*` : '';
    chunkLines(names.map((n, i) => `\`${String(i + 1).padStart(2)}.\` ${n}`))
      .forEach((chunk, i) => embed.addFields({
        name: i === 0 ? `${ICONS.ATTEND_ABSENT} Vắng (không điểm danh) — ${absentIds.length}` : '\u200b',
        value: chunk + (i === 0 ? extra : ''),
        inline: false,
      }));
  }

  const phaiText = buildPhaiStatsText(guild, phaiRoleIds, attended, session.eligible_member_ids);
  if (phaiText)
    embed.addFields({ name: `${ICONS.SWORD} Thống Kê Phái`, value: phaiText, inline: false });

  embed.setFooter({ text: `${FOOTER_DEFAULT} · Role: ${session.role_name}` });
  return embed;
}

// ─── Phase E: History Embed với tỷ lệ điểm danh ──────────────────────────────
/**
 * buildHistoryEmbed(history, attendanceSummaryMap)
 * @param {Array}  history              — mảng session từ db.getSessionHistory()
 * @param {Map}    attendanceSummaryMap — Map<sessionId, rows[]> từ db.getAttendanceSummaryForSessions()
 *                                       nếu null → chỉ hiện tên + ngày (fallback cũ)
 */
function buildHistoryEmbed(history, attendanceSummaryMap = null) {
  if (history.length === 0) {
    return new EmbedBuilder()
      .setAuthor(AUTHOR_DEFAULT)
      .setTitle(`${ICONS.HISTORY} Lịch Sử Điểm Danh`)
      .setColor(COLORS.INACTIVE)
      .setDescription('> Chưa có phiên nào được kết thúc.')
      .setFooter({ text: FOOTER_DEFAULT });
  }

  const lines = history.map((s, i) => {
    const startedAt = s.created_at ?? s.started_at ?? s.ended_at;
    const ts        = Math.floor(new Date(startedAt).getTime() / 1000);
    const eligible  = (s.eligible_member_ids ?? []).length;

    // Phase E: tính tỷ lệ nếu có attendanceSummaryMap
    let ratioStr = '';
    if (attendanceSummaryMap) {
      const rows     = attendanceSummaryMap.get(s.id) ?? [];
      const present  = rows.filter(r => ['tham_gia', 'tre'].includes(r.status)).length;
      const pct      = eligible > 0 ? Math.round((present / eligible) * 100) : 0;
      // Mini progress bar 8 chars
      const filled   = Math.round((pct / 100) * 8);
      const miniBar  = '▰'.repeat(filled) + '▱'.repeat(8 - filled);
      ratioStr       = ` · ${miniBar} **${pct}%** (${present}/${eligible})`;
    } else {
      ratioStr = ` · ${eligible} thành viên`;
    }

    return `\`${String(i + 1).padStart(2)}.\` **${s.session_name}** — <t:${ts}:d>${ratioStr}`;
  });

  return new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle(`${ICONS.HISTORY} Lịch Sử Điểm Danh — ${history.length} phiên gần nhất`)
    .setColor(COLORS.GOLD)
    .setDescription(chunkLines(lines, 3800)[0] ?? '—')
    .setFooter({ text: `${FOOTER_DEFAULT} · Dùng ID với /thong_ke_phien và /sua_diemdanh` })
    .setTimestamp();
}

// ─── Member Embed ──────────────────────────────────────────────────────────────
function buildMemberEmbed(member, stats, badge, pct, bar) {
  const streakBar = stats.current_streak > 0
    ? ICONS.STREAK_ACTIVE.repeat(Math.min(stats.current_streak, 10)) + (stats.current_streak > 10 ? ` x${stats.current_streak}` : '')
    : `${ICONS.STREAK_NONE} *(không có streak)*`;

  return new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle(`📋 ${member.displayName}`)
    .setColor(pctColor(pct))
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setDescription([
      `${pctEmoji(pct)} **${pct}%** — ${pctLabel(pct)}`,
      `\`${bar}\``,
      `> ${ICONS.CALENDAR} ${stats.total_joined} tham gia · ${stats.total_sessions} tổng phiên`,
    ].join('\n'))
    .addFields(
      { name: `${ICONS.FIRE} Streak Hiện Tại`, value: streakBar, inline: false },
      { name: `${ICONS.TROPHY} Streak Tốt Nhất`, value: `**${stats.best_streak ?? 0}** phiên`, inline: true },
      { name: `${ICONS.MEDAL} Huy Hiệu`, value: badge || '*(chưa có)*', inline: true },
    )
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();
}

// ─── Config Embed ──────────────────────────────────────────────────────────────
function buildConfigEmbed(cfg) {
  return new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle(`${ICONS.SETTINGS} Cấu Hình Server`)
    .setColor(COLORS.PRIMARY)
    .addFields(
      { name: `${ICONS.PERSON} Role Điểm Danh`, value: cfg.allowed_role_id ? `<@&${cfg.allowed_role_id}>` : '*(tất cả)*', inline: true },
      { name: `${ICONS.ROLE} Role Admin Bot`,   value: cfg.admin_role_id   ? `<@&${cfg.admin_role_id}>`   : '*(chưa đặt)*', inline: true },
      { name: `${ICONS.SWORD} Role Phái`, value: (cfg.phai_role_ids ?? []).length > 0
        ? cfg.phai_role_ids.map(id => `<@&${id}>`).join(' ')
        : '*(chưa cấu hình)*', inline: false },
    )
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();
}

// ─── Phase 6 + F: Server Stats Embed với trend sparkline ─────────────────────
/**
 * buildServerStatsEmbed(guild, stats, topMembers, topLimit, recentSessions)
 * @param {Array|null} recentSessions — mảng {attended_count, eligible_member_ids} 5 phiên gần nhất
 *                                      nếu null → không render field trend
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

    // ASCII sparkline: ▁▂▃▄▅▆▇█
    const SPARK = ['▁','▂','▃','▄','▅','▆','▇','█'];
    const maxP  = Math.max(...pcts);
    const minP  = Math.min(...pcts);
    const range = maxP - minP || 1;
    const sparkline = pcts.map(p => {
      const idx = Math.round(((p - minP) / range) * (SPARK.length - 1));
      return SPARK[idx];
    }).join('');

    // Trend: so sánh trung bình 2 phiên đầu vs 2 phiên cuối (newest-first array)
    // recentSessions[0] = mới nhất
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
      const passed = curH > hour || (curH === hour && curM >= minute);
      if (passed) daysUntil = 7;
    }
    const vnTarget = new Date(vnNow);
    vnTarget.setUTCHours(0, 0, 0, 0);
    const openDate = new Date(vnTarget.getTime() + (daysUntil * 86400 + hour * 3600 + minute * 60) * 1000 - TZ * 1000);
    return Math.floor(openDate.getTime() / 1000);
  }

  const fields = danhSach.map(lich => {
    const openUnix  = nextWeekdayUnix(lich.day_of_week, lich.hour, lich.minute);
    const closeUnix = lich.close_day_of_week != null
      ? nextWeekdayUnix(lich.close_day_of_week, lich.close_hour, lich.close_minute, openUnix)
      : null;

    const openLine  = `${ICONS.SESSION_OPEN} Mở: <t:${openUnix}:F> (<t:${openUnix}:R>)`;
    const closeLine = closeUnix
      ? `${ICONS.SESSION_CLOSED} Đóng: <t:${closeUnix}:F> (<t:${closeUnix}:R>)`
      : `${ICONS.SESSION_CLOSED} Đóng: *(thủ công)*`;

    const phaiLine = (lich.phai_role_ids ?? []).length > 0
      ? `${ICONS.SWORD} Phái: ${lich.phai_role_ids.map(id => `<@&${id}>`).join(' ')}`
      : null;

    const channelLine = lich.channel_id ? `${ICONS.BELL} Kênh: <#${lich.channel_id}>` : null;

    const valueParts = [openLine, closeLine];
    if (channelLine) valueParts.push(channelLine);
    if (phaiLine)    valueParts.push(phaiLine);

    return { name: `${ICONS.CALENDAR} ${lich.session_name}`, value: valueParts.join('\n'), inline: false };
  });

  const embed = new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle(`${ICONS.CALENDAR} Lịch Cố Định · ${guild?.name ?? 'Server'}`)
    .setColor(COLORS.INFO)
    .setDescription(`Tổng **${danhSach.length}** lịch đang hoạt động. Thời gian hiển thị theo múi giờ của bạn.`)
    .addFields(...fields)
    .setFooter({ text: `${FOOTER_DEFAULT} · Cập nhật lúc` })
    .setTimestamp();

  if (guild?.iconURL) {
    const url = guild.iconURL({ dynamic: true });
    if (url) embed.setThumbnail(url);
  }

  return embed;
}

// ─── Exports ───────────────────────────────────────────────────────────────────
module.exports = {
  COLORS, ICONS,
  embedSuccess, embedDanger, embedWarning, embedInfo, embedGray,
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
