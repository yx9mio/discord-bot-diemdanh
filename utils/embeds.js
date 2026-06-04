// utils/embeds.js — Tất cả embed builders & button builders
'use strict';
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } = require('discord.js');

// ─── Palette & Icons ────────────────────────────────────────────────
const COLORS = {
  GREEN:   0x57f287,
  RED:     0xff4444,
  BLUE:    0x5865f2,
  YELLOW:  0xfee75c,
  ORANGE:  0xf0a500,
  GREY:    0x36393e,
  PURPLE:  0x9b59b6,
  TEAL:    0x1abc9c,
  PRIMARY: 0x01696f,
  GOLD:    0xFFD700,
};

const ICONS = {
  SESSION_OPEN:   '🟢',
  SESSION_CLOSED: '🔴',
  ATTEND_YES:     '✅',
  ATTEND_LATE:    '🕐',
  ATTEND_NO:      '❌',
  ATTEND_ABSENT:  '📭',
  ATTEND_EXCUSE:  '📋',
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
  BELL:           '🔔',
  GEAR:           '⚙️',
};

const FOOTER_DEFAULT = 'Quản Gia · Bot Điểm Danh';
const AUTHOR_DEFAULT = { name: 'Quản Gia · Bot Điểm Danh' };
const COLOR_GOLD = COLORS.GOLD;

// ─── [#2] Attendance status options — single source of truth ──────────────────
const ATTENDANCE_OPTIONS = [
  { label: '✅ Tham gia', description: 'Điểm danh đúng giờ', value: 'tham_gia'        },
  { label: '🕐 Đến trễ', description: 'Điểm danh muộn',      value: 'tre'             },
  { label: '❌ Vắng',    description: 'Báo vắng mặt',         value: 'khong_tham_gia' },
  { label: '📋 Có phép', description: 'Vắng mặt có lý do',   value: 'co_phep'        },
];

// ─── Error / Success / Confirm reply helpers ──────────────────────────────────
function replyErr(msg = 'Có lỗi xảy ra. Vui lòng thử lại.') {
  return {
    embeds: [ new EmbedBuilder().setColor(COLORS.RED).setDescription(`❌ ${msg}`) ],
    flags: MessageFlags.Ephemeral,
  };
}

function replyOk(msg = 'Thành công.') {
  return {
    embeds: [ new EmbedBuilder().setColor(COLORS.GREEN).setDescription(`✅ ${msg}`) ],
    flags: MessageFlags.Ephemeral,
  };
}

function replyLoading(msg = 'Đang xử lý...') {
  return {
    embeds: [ new EmbedBuilder().setColor(COLORS.BLUE).setDescription(`⏳ ${msg}`) ],
    flags: MessageFlags.Ephemeral,
  };
}

function replyErrEdit(msg = 'Có lỗi xảy ra. Vui lòng thử lại.') {
  return {
    embeds: [ new EmbedBuilder().setColor(COLORS.RED).setDescription(`❌ ${msg}`) ],
    components: [],
  };
}

function replyWarnEdit(msg = 'Có vấn đề xảy ra.') {
  return {
    embeds: [ new EmbedBuilder().setColor(COLORS.YELLOW).setDescription(`⚠️ ${msg}`) ],
    components: [],
  };
}

function replyOkEdit(msg = 'Thành công.') {
  return {
    embeds: [ new EmbedBuilder().setColor(COLORS.GREEN).setDescription(`✅ ${msg}`) ],
    components: [],
  };
}

function replyConfirm(description, yesId, noId) {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(COLORS.YELLOW)
        .setDescription(`⚠️ ${description}`)
        .setFooter({ text: FOOTER_DEFAULT }),
    ],
    components: [ buildConfirmRow(yesId, noId) ],
    flags: MessageFlags.Ephemeral,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function pctColor(pct) {
  if (pct >= 80) return COLORS.GREEN;
  if (pct >= 50) return COLORS.ORANGE;
  return COLORS.RED;
}

function pctLabel(pct) {
  if (pct >= 90) return 'Xuất sắc';
  if (pct >= 75) return 'Tốt';
  if (pct >= 50) return 'Trung bình';
  return 'Cần cải thiện';
}

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

const buildProgressBar = buildRichProgressBar;

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}g ${m}p`;
  return `${m}p`;
}

// [#5-D3] Helper — tránh lặp (session.eligible_member_ids ?? []) khắp file
function getEligibleIds(session) {
  return Array.isArray(session.eligible_member_ids) ? session.eligible_member_ids : [];
}

// [#5-D1] Sync — dùng khi không thể await (render loop, map đồng bộ)
function resolveDisplayName(guild, userId, fallback) {
  if (!guild) return fallback;
  const cache = guild.members?.cache;
  if (!cache || typeof cache.get !== 'function') return fallback;
  const member = cache.get(userId);
  return member ? (member.displayName || member.user.username) : fallback;
}

// [#5-D1] Async — dùng khi cần tên chính xác và có thể await (vd: buildSummaryEmbed)
async function resolveDisplayNameAsync(guild, userId, fallback) {
  if (!guild) return fallback;
  try {
    const member = await guild.members.fetch(userId);
    return member ? (member.displayName || member.user.username) : fallback;
  } catch {
    return fallback;
  }
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

// ─── Phái stats helper ─────────────────────────────────────────────────────────
function buildPhaiStatsText(guild, phaiRoleIds, attended, eligibleArr) {
  if (!phaiRoleIds || !phaiRoleIds.length || !guild) return null;
  const safe = eligibleArr ?? [];
  const eligibleSet = new Set(safe.map ? safe.map(m => m.id ?? m) : []);
  const lines = [];
  for (const roleId of phaiRoleIds) {
    const role = guild.roles?.cache?.get(roleId);
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

// ─── Session Embed (live + closed view) ─────────────────────────────────────
function buildSessionEmbed(guild, session, attended, phaiRoleIds = [], isClosed = false, page = 1) {
  const PAGE_SIZE = 20;
  const joined   = attended.filter(a => a.status === 'tham_gia');
  const late     = attended.filter(a => a.status === 'tre');
  const declined = attended.filter(a => a.status === 'khong_tham_gia');
  const excused  = attended.filter(a => a.status === 'co_phep');

  // [#5-D3] Dùng getEligibleIds thay vì (session.eligible_member_ids ?? [])
  const eligibleIds  = getEligibleIds(session);
  const eligible     = eligibleIds.length;
  const presentCount = joined.length + late.length;
  const pct = eligible > 0 ? Math.round(presentCount / eligible * 100) : 0;

  const checkedIds = new Set(attended.map(a => a.user_id));
  const absentIds  = eligibleIds.filter(id => !checkedIds.has(id));

  const roleDisplay = session.allowed_role_id
    ? `<@&${session.allowed_role_id}>`
    : (session.role_name ?? 'Tất cả');

  let deadlineLine = '';
  if (!isClosed && session.ends_at) {
    const endsTs  = Math.floor(new Date(session.ends_at).getTime() / 1000);
    const nowSec  = Math.floor(Date.now() / 1000);
    const diffMin = Math.round((endsTs - nowSec) / 60);
    deadlineLine = diffMin > 0
      ? `\n⏱ Kết thúc <t:${endsTs}:R> · còn **${diffMin} phút**`
      : `\n⏱ Đã quá hạn`;
  }

  const statusLine = `${ICONS.SESSION_OPEN} **Đang mở** · ${roleDisplay} · ${eligible} thành viên${deadlineLine}`;

  // [#5-D2] fieldValue: tất cả field cùng dùng 1 page duy nhất — nhất quán UX
  // totalPages tính theo list DÀI nhất để tránh cắt sót dữ liệu
  const absMentions    = absentIds.map(id => `<@${id}>`);
  const declMentions   = declined.map(a => `<@${a.user_id}>`);
  const joinedMentions = joined.map(a => `<@${a.user_id}>`);
  const lateMentions   = late.map(a => `<@${a.user_id}>`);
  const absentAll      = [...declMentions, ...absMentions];

  const totalItems = Math.max(joinedMentions.length, lateMentions.length, absentAll.length);
  const totalPages = totalItems > 0 ? Math.ceil(totalItems / PAGE_SIZE) : 1;
  const clampedPage = Math.min(Math.max(page, 1), totalPages);
  const start = (clampedPage - 1) * PAGE_SIZE;

  function fieldValue(items, emptyMsg) {
    if (!items.length) return emptyMsg;
    const slice = items.slice(start, start + PAGE_SIZE);
    if (!slice.length) return `*(hết)*`;
    let val = slice.join(' ');
    // [#5-D2] Footer trang thống nhất — chỉ hiện khi có nhiều hơn 1 trang
    if (totalPages > 1) val += `\n*(trang ${clampedPage}/${totalPages})*`;
    return val;
  }

  const embed = new EmbedBuilder()
    .setColor(isClosed ? COLORS.RED : COLORS.GREEN)
    .setTitle(`${isClosed ? ICONS.SESSION_CLOSED : ICONS.SESSION_OPEN} ${session.session_name}`)
    .setDescription(isClosed ? `${ICONS.SESSION_CLOSED} **Phiên đã kết thúc**` : statusLine)
    .addFields(
      { name: `${ICONS.ATTEND_YES} Tham gia (${joined.length})`,  value: fieldValue(joinedMentions, '*Chưa có*'), inline: true },
      { name: `${ICONS.ATTEND_LATE} Đến trễ (${late.length})`,    value: fieldValue(lateMentions,   '*Chưa có*'), inline: true },
      { name: `${ICONS.ATTEND_NO} Vắng (${declined.length + absentIds.length})`, value: fieldValue(absentAll, '*Không có*'), inline: true },
    )
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  if (typeof guild?.iconURL === 'function') {
    const url = guild.iconURL({ dynamic: true, size: 64 });
    if (url) embed.setThumbnail(url);
  }

  if (!isClosed && eligible > 0) {
    embed.addFields({ name: `${ICONS.CHART} Tiến độ`, value: `${buildRichProgressBar(pct)} **${pct}%**`, inline: false });
  }

  if (excused.length > 0) {
    embed.addFields({ name: `${ICONS.ATTEND_EXCUSE} Có phép (${excused.length})`, value: excused.slice(0, 10).map(a => `<@${a.user_id}>`).join(' '), inline: false });
  }

  const phaiText = buildPhaiStatsText(
    guild,
    phaiRoleIds,
    attended,
    eligibleIds.map(id => ({ id })),
  );
  if (phaiText) {
    embed.addFields({ name: `${ICONS.SWORD} 🎭 Thống kê phái`, value: phaiText, inline: false });
  }

  const components = [];
  if (totalPages > 1) {
    const paginationRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`attend_view:prev:${clampedPage}`)
        .setLabel('◀ Trước')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(clampedPage === 1),
      new ButtonBuilder()
        .setCustomId(`attend_view:next:${clampedPage}`)
        .setLabel('Tiếp ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(clampedPage === totalPages),
    );
    components.push(paginationRow);
  }

  return { embed, components };
}

/**
 * buildClosedSessionEmbed — trả về { embed, components } nhất quán với buildSessionEmbed.
 * [#4/#7] Fix: destructure rõ ràng, không dùng ?. operator mơ hồ.
 */
function buildClosedSessionEmbed(session, attended, guild = null) {
  const { embed } = buildSessionEmbed(guild, session, attended ?? [], [], true);
  return { embed, components: [] };
}

// ─── Summary Embed (async — dùng resolveDisplayNameAsync cho tên chính xác) ────
async function buildSummaryEmbed(session, attended, guild = null, phaiRoleIds = null) {
  const joined       = attended.filter(a => a.status === 'tham_gia');
  const late         = attended.filter(a => a.status === 'tre');
  const declined     = attended.filter(a => a.status === 'khong_tham_gia');
  const excused      = attended.filter(a => a.status === 'co_phep');

  // [#5-D3]
  const eligibleIds  = getEligibleIds(session);
  const eligible     = eligibleIds.length;
  const presentCount = joined.length + late.length;
  const pct          = eligible > 0 ? Math.round((presentCount / eligible) * 100) : 0;

  const startedAt = session.created_at ?? session.started_at;
  const startTs   = Math.floor(new Date(startedAt).getTime() / 1000);
  const endTs     = session.ended_at ? Math.floor(new Date(session.ended_at).getTime() / 1000) : null;
  const dur       = endTs ? formatDuration(endTs - startTs) : null;

  const badge  = pct >= 90 ? '🏆 Xuất sắc' : pct >= 80 ? '🥇 Tốt' : pct >= 60 ? '🥈 Khá' : pct >= 40 ? '🥉 TB' : '📉 Thấp';
  const richBar = buildRichProgressBar(pct);

  const descLines = [
    `## ${pctEmoji(pct)} ${pct}% — ${badge}`,
    `\`${richBar}\``,
    '',
    `> ${ICONS.ATTEND_YES} \`${joined.length} tham gia\`  ${ICONS.ATTEND_LATE} \`${late.length} trễ\`  ${ICONS.ATTEND_EXCUSE} \`${excused.length} có phép\`  ${ICONS.ATTEND_NO} \`${declined.length} vắng\`  ${ICONS.PERSON} \`${eligible} thành viên\``,
    '',
    `${ICONS.CLOCK} <t:${startTs}:f>${endTs ? `  →  <t:${endTs}:f>` : ''}${dur ? `  ·  ⏱ **${dur}**` : ''}`,
  ];

  const embed = new EmbedBuilder()
    .setColor(pct >= 80 ? COLORS.GREEN : pct >= 60 ? COLORS.YELLOW : COLORS.RED)
    .setTitle(`📊 Kết quả: ${session.session_name}`)
    .setDescription(descLines.join('\n'))
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  if (typeof guild?.iconURL === 'function') {
    const url = guild.iconURL({ dynamic: true, size: 64 });
    if (url) embed.setThumbnail(url);
  }

  const earliest = [...joined, ...late]
    .filter(a => a.checked_in_at)
    .sort((a, b) => new Date(a.checked_in_at) - new Date(b.checked_in_at))
    .slice(0, 3);
  if (earliest.length > 0) {
    const medals = ['🥇', '🥈', '🥉'];
    embed.addFields({
      name: '⚡ Điểm danh sớm nhất',
      value: earliest.map((a, i) => `${medals[i]} <@${a.user_id}> · <t:${Math.floor(new Date(a.checked_in_at).getTime() / 1000)}:t>`).join('\n'),
      inline: false,
    });
  }

  // [#5-D1] Dùng resolveDisplayNameAsync để lấy tên chính xác kể cả khi chưa cache
  const MAX = 25;

  if (joined.length > 0) {
    const names = await Promise.all(
      joined.slice(0, MAX).map((a, i) =>
        resolveDisplayNameAsync(guild, a.user_id, `<@${a.user_id}>`)
          .then(name => `\`${String(i + 1).padStart(2)}.\` ${name}`)
      )
    );
    const extra = joined.length > MAX ? `\n*(+${joined.length - MAX} nữa)*` : '';
    chunkLines(names).slice(0, 1).forEach(chunk =>
      embed.addFields({ name: `${ICONS.ATTEND_YES} Tham Gia (${joined.length})`, value: chunk + extra, inline: true })
    );
  }

  if (late.length > 0) {
    const names = await Promise.all(
      late.slice(0, MAX).map((a, i) =>
        resolveDisplayNameAsync(guild, a.user_id, `<@${a.user_id}>`)
          .then(name => `\`${String(i + 1).padStart(2)}.\` ${name}`)
      )
    );
    const extra = late.length > MAX ? `\n*(+${late.length - MAX} nữa)*` : '';
    chunkLines(names).slice(0, 1).forEach(chunk =>
      embed.addFields({ name: `${ICONS.ATTEND_LATE} Đến Trễ (${late.length})`, value: chunk + extra, inline: true })
    );
  }

  // [#5-D3]
  const absentIds2 = eligibleIds.filter(
    id => !new Set(attended.map(a => a.user_id)).has(id)
  );
  if (absentIds2.length > 0) {
    const MAX2 = 25;
    const names2 = await Promise.all(
      absentIds2.slice(0, MAX2).map((id, i) =>
        resolveDisplayNameAsync(guild, id, `<@${id}>`)
          .then(name => `\`${String(i + 1).padStart(2)}.\` ${name}`)
      )
    );
    const extra2 = absentIds2.length > MAX2 ? `\n*(+${absentIds2.length - MAX2} nữa)*` : '';
    chunkLines(names2).slice(0, 1).forEach(chunk =>
      embed.addFields({ name: `${ICONS.ATTEND_ABSENT} Vắng Mặt (${absentIds2.length})`, value: chunk + extra2, inline: false })
    );
  }

  if (excused.length > 0) {
    embed.addFields({
      name: `${ICONS.ATTEND_EXCUSE} Có Phép (${excused.length})`,
      value: excused.slice(0, 10).map(a => `<@${a.user_id}>`).join(' '),
      inline: false,
    });
  }

  const phaiText2 = buildPhaiStatsText(
    guild,
    phaiRoleIds,
    attended,
    eligibleIds.map(id => ({ id })),
  );
  if (phaiText2)
    embed.addFields({ name: `${ICONS.SWORD} Thống Kê Phái`, value: phaiText2, inline: false });

  return embed;
}

// ─── Confirm Row ───────────────────────────────────────────────────────────────
function buildConfirmRow(yesId, noId, yesLabel = '✅ Xác nhận', noLabel = '↩️ Hủy') {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(yesId).setLabel(yesLabel).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(noId).setLabel(noLabel).setStyle(ButtonStyle.Secondary),
  );
}

// ─── Attendance Confirm Embed ──────────────────────────────────────────────────
function buildAttendConfirmEmbed(member, status, sessionName, streak) {
  const colorMap = {
    tham_gia:       COLORS.GREEN,
    tre:            COLORS.YELLOW,
    khong_tham_gia: COLORS.RED,
    co_phep:        COLORS.BLUE,
  };
  const labelMap = {
    tham_gia:       `${ICONS.ATTEND_YES} Đã điểm danh`,
    tre:            `${ICONS.ATTEND_LATE} Điểm danh trễ`,
    khong_tham_gia: `${ICONS.ATTEND_NO} Đã đăng ký vắng`,
    co_phep:        `${ICONS.ATTEND_EXCUSE} Nghỉ có phép`,
  };

  const nowTs = Math.floor(Date.now() / 1000);
  const name  = member?.displayName ?? member?.user?.username ?? 'Thành viên';

  const embed = new EmbedBuilder()
    .setColor(colorMap[status] ?? COLORS.GREY)
    .setTitle(labelMap[status] ?? status)
    .setDescription(`👤 **${name}** · 📋 ${sessionName}`)
    .addFields({ name: `${ICONS.CLOCK} Thời điểm`, value: `<t:${nowTs}:T>`, inline: true })
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  if (typeof member?.displayAvatarURL === 'function') {
    const url = member.displayAvatarURL({ dynamic: true, size: 64 });
    if (url) embed.setThumbnail(url);
  }

  if (streak != null && streak > 0 && ['tham_gia', 'tre'].includes(status)) {
    if (streak >= 3) {
      embed.addFields({ name: `${ICONS.FIRE} Streak`, value: `**${streak}** phiên liên tiếp`, inline: true });
    } else if (streak === 1) {
      embed.addFields({ name: `${ICONS.SPARKLE} Streak`, value: `Bắt đầu chuỗi mới!`, inline: true });
    } else {
      embed.addFields({ name: `${ICONS.FIRE} Streak`, value: `**${streak}** phiên liên tiếp`, inline: true });
    }
  }

  return { embeds: [embed], flags: MessageFlags.Ephemeral };
}

// ─── Admin Override Success Embed ─────────────────────────────────────────────
function buildAdminOverrideSuccessEmbed(targetUserId, oldStatus, newStatus, adminUserId) {
  const statusLabel = s => ({
    tham_gia:       `${ICONS.ATTEND_YES} Tham gia`,
    tre:            `${ICONS.ATTEND_LATE} Đến trễ`,
    khong_tham_gia: `${ICONS.ATTEND_NO} Vắng`,
    co_phep:        `${ICONS.ATTEND_EXCUSE} Có phép`,
  }[s] ?? s);

  const nowTs = Math.floor(Date.now() / 1000);

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(COLORS.ORANGE)
        .setTitle('🛠️ Admin Override thành công')
        .addFields(
          { name: `${ICONS.PERSON} Thành viên`, value: `<@${targetUserId}>`, inline: true },
          { name: 'Trạng thái cũ → mới', value: `${statusLabel(oldStatus)} → **${statusLabel(newStatus)}**`, inline: true },
          { name: '👮 Admin', value: `<@${adminUserId}>`, inline: true },
          { name: `${ICONS.CLOCK} Thời điểm`, value: `<t:${nowTs}:f>`, inline: false },
        )
        .setFooter({ text: FOOTER_DEFAULT })
        .setTimestamp(),
    ],
    flags: MessageFlags.Ephemeral,
  };
}

// ─── Session Action Rows ───────────────────────────────────────────────────────
function buildSessionActionRow(disabled = false, isAdmin = true) {
  const d = disabled;

  const rows = [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('attendance:select')
        .setPlaceholder('👆 Chọn trạng thái điểm danh...')
        .setDisabled(d)
        .addOptions(
          ATTENDANCE_OPTIONS.map(o =>
            new StringSelectMenuOptionBuilder()
              .setLabel(o.label)
              .setDescription(o.description)
              .setValue(o.value)
          )
        )
    ),
  ];

  if (isAdmin) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('attend_view').setLabel('👁 Xem').setStyle(ButtonStyle.Secondary).setDisabled(d),
        new ButtonBuilder().setCustomId('attend_refresh').setLabel('🔄 Làm mới').setStyle(ButtonStyle.Secondary).setDisabled(d),
        new ButtonBuilder().setCustomId('admin:mark').setLabel('✏️ Điểm danh thay').setStyle(ButtonStyle.Primary).setDisabled(d),
        new ButtonBuilder().setCustomId('session:export_csv').setLabel('📄 Xuất CSV').setStyle(ButtonStyle.Success).setDisabled(d),
        new ButtonBuilder().setCustomId('session:cancel').setLabel('⛔ Hủy phiên').setStyle(ButtonStyle.Danger).setDisabled(d),
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('attend_close').setLabel('🔴 Đóng phiên').setStyle(ButtonStyle.Danger).setDisabled(d),
      ),
    );
  }

  return rows;
}

function buildHistoryNavRow(currentPage, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('history:prev').setLabel('← Trước').setStyle(ButtonStyle.Secondary).setDisabled(currentPage <= 1),
    new ButtonBuilder().setCustomId('history:page').setLabel(`Trang ${currentPage}/${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('history:next').setLabel('Tiếp →').setStyle(ButtonStyle.Secondary).setDisabled(currentPage >= totalPages),
  );
}

function buildConfigEmbed(cfg) {
  const val  = v => (v ? `<@&${v}>` : '*(chưa cài)*');
  const ch   = v => (v ? `<#${v}>` : '*(chưa cài)*');
  const num  = v => (v != null ? `\`${v}\`` : '*(chưa cài)*');
  const bool = v => (v ? '✅ Bật' : '⛔ Tắt');

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(COLORS.BLUE)
        .setTitle(`${ICONS.GEAR} Cấu hình Server`)
        .addFields(
          { name: '👮 Role Admin',        value: val(cfg?.admin_role_id),       inline: true },
          { name: '📋 Role Điểm danh',    value: val(cfg?.attendance_role_id),  inline: true },
          { name: `${ICONS.SWORD} Role Phái`, value: val(cfg?.phai_role_id),   inline: true },
          { name: '📢 Channel thông báo', value: ch(cfg?.notify_channel_id),   inline: true },
          { name: '📅 Lịch cố định',      value: num(cfg?.fixed_schedule_count ?? cfg?.schedule_count), inline: true },
          { name: '🗂 Preset',            value: bool(cfg?.preset_active ?? cfg?.preset_enabled),       inline: true },
        )
        .setFooter({ text: FOOTER_DEFAULT })
        .setTimestamp(),
    ],
    flags: MessageFlags.Ephemeral,
  };
}

// ─── Rank Embed ────────────────────────────────────────────────────────────────
function buildRankEmbed(rows, guild, topN) {
  const medals = ['🥇', '🥈', '🥉'];
  if (!rows?.length) {
    return new EmbedBuilder()
      .setColor(COLORS.PURPLE)
      .setTitle('🏆 Bảng xếp hạng')
      .setDescription('_Chưa có dữ liệu xếp hạng._')
      .setFooter({ text: FOOTER_DEFAULT })
      .setTimestamp();
  }
  const lines = rows.slice(0, topN ?? 10).map((r, i) => {
    const medal  = medals[i] ?? `\`${String(i + 1).padStart(2)}.\``;
    const name   = resolveDisplayName(guild, r.user_id, `<@${r.user_id}>`);
    const joined = r.total_joined ?? r.tham_gia ?? 0;
    const total  = r.total_sessions ?? 0;
    const streak = r.current_streak ?? r.streak ?? 0;
    const pct    = total > 0 ? Math.round(joined / total * 100) : 0;
    return `${medal} **${name}** — ${joined} phiên · ${pct}% · 🔥 ${streak}`;
  });
  return new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle(`🏆 Top ${Math.min(rows.length, topN ?? 10)} — Bảng xếp hạng`)
    .setDescription(lines.join('\n'))
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();
}

module.exports = {
  COLORS, ICONS, FOOTER_DEFAULT, AUTHOR_DEFAULT, COLOR_GOLD,
  ATTENDANCE_OPTIONS,
  replyErr, replyOk, replyLoading, replyErrEdit, replyWarnEdit, replyOkEdit, replyConfirm,
  pctColor, pctLabel, pctEmoji,
  buildRichProgressBar, buildProgressBar,
  formatDuration,
  // [#5-D3]
  getEligibleIds,
  // [#5-D1] Export cả sync và async
  resolveDisplayName, resolveDisplayNameAsync,
  chunkLines,
  buildPhaiStatsText,
  buildSessionEmbed, buildClosedSessionEmbed,
  buildSummaryEmbed,
  buildConfirmRow,
  buildAttendConfirmEmbed,
  buildAdminOverrideSuccessEmbed,
  buildSessionActionRow,
  buildHistoryNavRow,
  buildConfigEmbed,
  buildRankEmbed,
};
