// utils/embeds.js — Tất cả embed builders & button builders
// Phase 1: Design system thống nhất — COLORS, ICONS, helpers
// Phase 3: buildSessionEmbed & buildSummaryEmbed nâng cấp visual
// Phase 5: buildHistoryEmbed + buildMemberEmbed
// Phase 6 + F: buildServerStatsEmbed + trend sparkline
// UX-A: buildAttendanceButtons + buildSetupMenu
// UX-B: buildSummaryEmbed cột vắng mặt
// UX-C: buildSummaryEmbed cột phái
// Phase G: buildSummaryEmbed thêm cột đến trễ
// M-1: eligible_member_ids null guard — fix crash lịch cố định
// Fix: export AUTHOR_DEFAULT + replyErr + replyErrEdit
// Fix E-1: ephemeral → MessageFlags.Ephemeral
'use strict';
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');

// ─── Palette & Icons ────────────────────────────────────────────────
const COLORS = {
  GREEN:  0x57f287,
  RED:    0xff4444,
  BLUE:   0x5865f2,
  YELLOW: 0xfee75c,
  ORANGE: 0xf0a500,
  GREY:   0x36393e,
  PURPLE: 0x9b59b6,
  TEAL:   0x1abc9c,
};

const ICONS = {
  SESSION_OPEN:   '🟢',
  SESSION_CLOSED: '🔴',
  ATTEND_YES:     '✅',
  ATTEND_LATE:    '🕐',
  ATTEND_NO:      '❌',
  ATTEND_ABSENT:  '📭',
  PERSON:         '👤',
  CLOCK:          '🕒',
  SWORD:          '⚔️',
  STAR:           '⭐',
  TROPHY:         '🏆',
  CHART:          '📊',
  CALENDAR:       '📅',
  FIRE:           '🔥',
  SHIELD:         '🛡️',
  SPARKLE:        '✨',
};

const FOOTER_DEFAULT = 'Quản Gia · Bot Điểm Danh';

// AUTHOR_DEFAULT dùng trong setAuthor() — phải là object { name, iconURL? }
const AUTHOR_DEFAULT = { name: 'Quản Gia · Bot Điểm Danh' };

// ─── Error reply helpers (dùng bởi errorHandler.js) ────────────────────
function replyErr(msg = 'Có lỗi xảy ra. Vui lòng thử lại.') {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(COLORS.RED)
        .setDescription(`❌ ${msg}`),
    ],
    flags: MessageFlags.Ephemeral,
  };
}

// replyErrEdit — dùng cho interaction.editReply (đã deferred), xóa components
function replyErrEdit(msg = 'Có lỗi xảy ra. Vui lòng thử lại.') {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(COLORS.RED)
        .setDescription(`❌ ${msg}`),
    ],
    components: [],
  };
}

// replyWarnEdit — dùng cho editReply warning (public, không ephemeral)
function replyWarnEdit(msg = 'Có vấn đề xảy ra.') {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(COLORS.YELLOW)
        .setDescription(`⚠️ ${msg}`),
    ],
    components: [],
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function pctEmoji(pct) {
  if (pct >= 90) return '🏆';
  if (pct >= 80) return '🥇';
  if (pct >= 60) return '🥈';
  if (pct >= 40) return '🥉';
  return '📉';
}

function buildRichProgressBar(pct, len = 12) {
  const filled = Math.round(pct / 100 * len);
  const empty  = len - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}g ${m}p`;
  return `${m}p`;
}

function resolveDisplayName(guild, userId, fallback) {
  if (!guild) return fallback;
  const member = guild.members.cache.get(userId);
  return member ? (member.displayName || member.user.username) : fallback;
}

function chunkLines(lines, maxLen = 1020) {
  const chunks = [];
  let cur = '';
  for (const line of lines) {
    if ((cur + '\n' + line).length > maxLen) { chunks.push(cur); cur = line; }
    else cur = cur ? cur + '\n' + line : line;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

// ─── Phái stats helper ──────────────────────────────────────────────────────────────
function buildPhaiStatsText(guild, phaiRoleIds, attended, eligibleArr) {
  if (!phaiRoleIds || !phaiRoleIds.length || !guild) return null;
  const safe = eligibleArr ?? [];
  const eligibleSet = new Set(safe.map ? safe.map(m => m.id ?? m) : []);
  const lines = [];
  for (const roleId of phaiRoleIds) {
    const role = guild.roles.cache.get(roleId);
    if (!role) continue;
    const roleMembers = [...role.members.keys()].filter(id => eligibleSet.size === 0 || eligibleSet.has(id));
    const total   = roleMembers.length;
    const present = attended.filter(a =>
      roleMembers.includes(a.user_id) && ['tham_gia', 'tre'].includes(a.status)
    ).length;
    const pct = total > 0 ? Math.round(present / total * 100) : 0;
    lines.push(`${ICONS.SWORD} **${role.name}**: ${present}/${total} (${pct}%)`);
  }
  return lines.length ? lines.join('\n') : null;
}

// ─── Session Embed (live + closed view) ─────────────────────────────────
async function buildSessionEmbed(guild, session, attended, isClosed = false) {
  const joined   = attended.filter(a => a.status === 'tham_gia');
  const late     = attended.filter(a => a.status === 'tre');
  const declined = attended.filter(a => a.status === 'khong_tham_gia');
  const excused  = attended.filter(a => a.status === 'co_phep');

  const eligible = (session.eligible_member_ids ?? []).length;
  const presentCount = joined.length + late.length;
  const pct = eligible > 0 ? Math.round(presentCount / eligible * 100) : 0;

  const checkedIds = new Set(attended.map(a => a.user_id));
  const absentIds  = (session.eligible_member_ids ?? []).filter(id => !checkedIds.has(id));

  const startedAt = session.created_at ?? session.started_at;
  const startTs   = Math.floor(new Date(startedAt).getTime() / 1000);

  const roleDisplay = session.allowed_role_id
    ? `<@&${session.allowed_role_id}>`
    : (session.role_name ?? 'Tất cả');

  const statusLine = `${ICONS.SESSION_OPEN} **Đang mở** · ${roleDisplay} · ${eligible} thành viên`;

  const embed = new EmbedBuilder()
    .setColor(isClosed ? COLORS.RED : COLORS.GREEN)
    .setTitle(`${isClosed ? ICONS.SESSION_CLOSED : ICONS.SESSION_OPEN} ${session.session_name}`)
    .setDescription(isClosed ? `${ICONS.SESSION_CLOSED} **Phiên đã kết thúc**` : statusLine)
    .addFields(
      { name: `${ICONS.ATTEND_YES} Tham gia (${joined.length})`, value: joined.length ? joined.slice(0, 10).map(a => `<@${a.user_id}>`).join(' ') + (joined.length > 10 ? ` *(+${joined.length - 10})*` : '') : '*Chưa có*', inline: true },
      { name: `${ICONS.ATTEND_LATE} Đến trễ (${late.length})`, value: late.length ? late.slice(0, 10).map(a => `<@${a.user_id}>`).join(' ') + (late.length > 10 ? ` *(+${late.length - 10})*` : '') : '*Chưa có*', inline: true },
      { name: `${ICONS.ATTEND_NO} Vắng (${declined.length + absentIds.length})`, value: (declined.length + absentIds.length) ? [...declined.slice(0, 5).map(a => `<@${a.user_id}>`), ...absentIds.slice(0, 5).map(id => `<@${id}>`)].join(' ') + ((declined.length + absentIds.length) > 10 ? ` *(+${declined.length + absentIds.length - 10})*` : '') : '*Không có*', inline: true },
    )
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  if (!isClosed && eligible > 0) {
    embed.addFields({ name: `${ICONS.CHART} Tiến độ`, value: `${buildRichProgressBar(pct)} **${pct}%**`, inline: false });
  }

  if (excused.length > 0) {
    embed.addFields({ name: `📋 Có phép (${excused.length})`, value: excused.slice(0, 10).map(a => `<@${a.user_id}>`).join(' '), inline: false });
  }

  return embed;
}

// ─── Summary Embed (khi đóng phiên) ─────────────────────────────────────────
function buildSummaryEmbed(session, attended, guild = null, phaiRoleIds = null) {
  const joined       = attended.filter(a => a.status === 'tham_gia');
  const late         = attended.filter(a => a.status === 'tre');
  const declined     = attended.filter(a => a.status === 'khong_tham_gia');
  const eligible     = (session.eligible_member_ids ?? []).length;
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
    .setColor(pct >= 80 ? COLORS.GREEN : pct >= 60 ? COLORS.YELLOW : COLORS.RED)
    .setTitle(`📊 Kết quả: ${session.session_name}`)
    .setDescription(descLines.join('\n'))
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  if (joined.length > 0) {
    const MAX = 25;
    const names = joined.slice(0, MAX)
      .map((a, i) => `\`${String(i + 1).padStart(2)}.\` ${resolveDisplayName(guild, a.user_id, `<@${a.user_id}>`)}`);
    const extra = joined.length > MAX ? `\n*(+${joined.length - MAX} nữa)*` : '';
    chunkLines(names).slice(0, 1).forEach(chunk =>
      embed.addFields({
        name: `${ICONS.ATTEND_YES} Tham Gia (${joined.length})`,
        value: chunk + extra, inline: true,
      })
    );
  }

  if (late.length > 0) {
    const MAX = 25;
    const names = late.slice(0, MAX)
      .map((a, i) => `\`${String(i + 1).padStart(2)}.\` ${resolveDisplayName(guild, a.user_id, `<@${a.user_id}>`)}`);
    const extra = late.length > MAX ? `\n*(+${late.length - MAX} nữa)*` : '';
    chunkLines(names).slice(0, 1).forEach(chunk =>
      embed.addFields({
        name: `${ICONS.ATTEND_LATE} Đến Trễ — ${late.length}`, value: chunk, inline: true,
      }));
  }

  const absentIds2 = (session.eligible_member_ids ?? []).filter(
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
    (session.eligible_member_ids ?? []).map(id => ({ id }))
  );
  if (phaiText2)
    embed.addFields({ name: `${ICONS.SWORD} Thống Kê Phái`, value: phaiText2, inline: false });

  embed.setFooter({ text: FOOTER_DEFAULT }).setTimestamp();
  return embed;
}

// ─── Attendance Buttons ───────────────────────────────────────────────────────
function buildAttendanceButtons(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('attendance:join')
      .setLabel('✅ Tham gia')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('attendance:late')
      .setLabel('🕐 Đến trễ')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('attendance:decline')
      .setLabel('❌ Vắng')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
  );
}

// ─── Setup Menu ──────────────────────────────────────────────────────────────────
function buildSetupMenu() {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(COLORS.BLUE)
        .setTitle('⚙️ Bảng Điều Khiển')
        .setDescription('Chọn chức năng bên dưới để quản lý bot điểm danh.')
        .setFooter({ text: FOOTER_DEFAULT }),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('setup:menu')
          .setPlaceholder('Chọn chức năng...')
          .addOptions([
            { label: '📋 Phiên điểm danh', description: 'Mở/đóng và xem lịch sử', value: 'session' },
            { label: '📅 Lịch cố định', description: 'Thiết lập điểm danh tự động', value: 'lich' },
            { label: '🏅 Huy hiệu', description: 'Quản lý huy hiệu thành tích', value: 'badge' },
            { label: '📊 Thống kê', description: 'Xem báo cáo và thống kê', value: 'stats' },
            { label: '⚙️ Cài đặt', description: 'Cấu hình server', value: 'settings' },
          ]),
      ),
    ],
    flags: MessageFlags.Ephemeral,
  };
}

// ─── History Embed ────────────────────────────────────────────────────────────────
function buildHistoryEmbed(guild, sessions, page = 1, perPage = 10) {
  const total = sessions.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const start = (page - 1) * perPage;
  const slice = sessions.slice(start, start + perPage);

  const lines = slice.map((s, i) => {
    const idx = start + i + 1;
    const ts  = Math.floor(new Date(s.created_at ?? s.started_at).getTime() / 1000);
    const elig = (s.eligible_member_ids ?? []).length;
    const pres = s.present_count ?? 0;
    const pct  = elig > 0 ? Math.round(pres / elig * 100) : 0;
    return `\`${String(idx).padStart(3)}.\` **${s.session_name}** · <t:${ts}:d> · ${pres}/${elig} (${pct}%)`;
  });

  return new EmbedBuilder()
    .setColor(COLORS.BLUE)
    .setTitle(`📋 Lịch sử điểm danh · Trang ${page}/${totalPages}`)
    .setDescription(lines.join('\n') || '*Chưa có phiên nào.*')
    .setFooter({ text: `${FOOTER_DEFAULT} · Tổng: ${total} phiên` });
}

// ─── Member Embed ────────────────────────────────────────────────────────────────────
function buildMemberEmbed(guild, userId, stats, badges) {
  const member = guild?.members.cache.get(userId);
  const name   = member ? (member.displayName || member.user.username) : `<@${userId}>`;

  const embed = new EmbedBuilder()
    .setColor(COLORS.PURPLE)
    .setTitle(`${ICONS.PERSON} Hồ sơ: ${name}`)
    .setThumbnail(member?.displayAvatarURL() ?? null)
    .addFields(
      { name: '📅 Tổng tham gia', value: `\`${stats?.total_joined ?? 0}\``, inline: true },
      { name: `${ICONS.FIRE} Streak hiện tại`, value: `\`${stats?.current_streak ?? 0}\``, inline: true },
      { name: `${ICONS.TROPHY} Streak cao nhất`, value: `\`${stats?.max_streak ?? 0}\``, inline: true },
    )
    .setFooter({ text: FOOTER_DEFAULT });

  if (badges && badges.length > 0) {
    embed.addFields({
      name: `${ICONS.STAR} Huy hiệu (${badges.length})`,
      value: badges.map(b => `\`${b.threshold} phiên\``).join(' · '),
      inline: false,
    });
  }

  return embed;
}

// ─── Server Stats Embed ───────────────────────────────────────────────────────────────
function buildServerStatsEmbed(guild, stats) {
  const { totalSessions, totalPresent, topMembers, recentSessions } = stats;

  const embed = new EmbedBuilder()
    .setColor(COLORS.TEAL)
    .setTitle(`${ICONS.CHART} Thống kê Server: ${guild.name}`)
    .setThumbnail(guild.iconURL())
    .addFields(
      { name: '📅 Tổng phiên', value: `\`${totalSessions}\``, inline: true },
      { name: `${ICONS.ATTEND_YES} Tổng lượt tham gia`, value: `\`${totalPresent}\``, inline: true },
    )
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  if (topMembers && topMembers.length > 0) {
    const topLines = topMembers.slice(0, 10).map((m, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `\`${i + 1}.\``;
      return `${medal} <@${m.user_id}> — \`${m.total_joined}\` phiên`;
    });
    embed.addFields({ name: `${ICONS.TROPHY} Top thành viên`, value: topLines.join('\n'), inline: false });
  }

  if (recentSessions && recentSessions.length > 0) {
    const recentLines = recentSessions.slice(0, 5).map(s => {
      const ts  = Math.floor(new Date(s.created_at ?? s.started_at).getTime() / 1000);
      const eligible = (s.eligible_member_ids ?? []).length;
      const pct  = eligible > 0 ? Math.round((s.present_count ?? 0) / eligible * 100) : 0;
      return `• **${s.session_name}** · <t:${ts}:d> · ${pctEmoji(pct)} ${pct}%`;
    });
    embed.addFields({ name: `${ICONS.CALENDAR} Phiên gần đây`, value: recentLines.join('\n'), inline: false });
  }

  return embed;
}

// ─── Trend Sparkline ───────────────────────────────────────────────────────────────────
function buildTrendSparkline(sessions) {
  if (!sessions || sessions.length === 0) return '*(chưa có dữ liệu)*';
  const values = sessions.map(s => {
    const eligible = (s.eligible_member_ids ?? []).length;
    return eligible > 0 ? Math.round((s.present_count ?? 0) / eligible * 100) : 0;
  });
  const bars = ['▁','▂','▃','▄','▅','▆','▇','█'];
  const max  = Math.max(...values, 1);
  return values.map(v => bars[Math.min(7, Math.floor(v / max * 7))]).join('');
}

// ─── Weekly Stats Embed ───────────────────────────────────────────────────────────────
function buildWeeklyStatsEmbed(guild, weekSessions, allSessions) {
  const thisWeek = weekSessions ?? [];
  const all      = allSessions ?? [];

  const weekPresent = thisWeek.reduce((s, sess) => s + (sess.present_count ?? 0), 0);
  const weekElig    = thisWeek.reduce((s, sess) => s + (sess.eligible_member_ids ?? []).length, 0);
  const weekPct     = weekElig > 0 ? Math.round(weekPresent / weekElig * 100) : 0;

  const sparkline   = buildTrendSparkline(all.slice(-10));

  const lines = thisWeek.map(s => {
    const ts  = Math.floor(new Date(s.created_at ?? s.started_at).getTime() / 1000);
    const eligible = (s.eligible_member_ids ?? []).length;
    const pct  = eligible > 0 ? Math.round((s.present_count ?? 0) / eligible * 100) : 0;
    return `• **${s.session_name}** · <t:${ts}:d> · ${buildRichProgressBar(pct, 8)} ${pct}%`;
  });

  return new EmbedBuilder()
    .setColor(COLORS.TEAL)
    .setTitle(`${ICONS.CHART} Thống kê tuần này`)
    .setDescription(lines.join('\n') || '*Không có phiên nào tuần này.*')
    .addFields(
      { name: 'Tỉ lệ chung', value: `${buildRichProgressBar(weekPct)} **${weekPct}%**`, inline: false },
      { name: `${ICONS.CHART} Xu hướng 10 phiên gần nhất`, value: `\`${sparkline}\``, inline: false },
    )
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();
}

module.exports = {
  COLORS,
  ICONS,
  FOOTER_DEFAULT,
  AUTHOR_DEFAULT,
  replyErr,
  replyErrEdit,
  replyWarnEdit,
  buildSessionEmbed,
  buildSummaryEmbed,
  buildAttendanceButtons,
  buildSetupMenu,
  buildHistoryEmbed,
  buildMemberEmbed,
  buildServerStatsEmbed,
  buildWeeklyStatsEmbed,
  buildTrendSparkline,
  buildPhaiStatsText,
  buildRichProgressBar,
  pctEmoji,
  resolveDisplayName,
  chunkLines,
  formatDuration,
};
