'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {
  COLORS, ICONS, FOOTER_DEFAULT,
  pctEmoji, pctLabel, formatDuration, buildAuthor,
} = require('../_helpers');
const { getPhaiIcon } = require('../theme.js');
const { buildPublicUrl } = require('../phaiIcons.js');

const PAGE_SIZE = 15;

// ─── ANSI helpers ────────────────────────────────────────────────────────────
const ANSI = {
  RESET:   '\x1b[0m',
  BOLD:    '\x1b[1m',
  GREEN:   '\x1b[1;32m',
  YELLOW:  '\x1b[1;33m',
  RED:     '\x1b[1;31m',
  CYAN:    '\x1b[1;36m',
  MAGENTA: '\x1b[1;35m',
  BLUE:    '\x1b[1;34m',
  GREY:    '\x1b[1;30m',
  WHITE:   '\x1b[1;37m',
};

/** Thanh tiến độ Unicode mảnh — 10 ký tự */
function _progressBar(pct, len = 10) {
  const filled = Math.round(pct / 100 * len);
  const empty  = len - filled;
  return '▰'.repeat(filled) + '▱'.repeat(empty);
}

/** Thanh tiến độ ANSI có màu theo tỷ lệ */
function _ansiBar(pct, len = 10) {
  const color = pct >= 80 ? ANSI.GREEN : pct >= 50 ? ANSI.YELLOW : ANSI.RED;
  return `${color}${_progressBar(pct, len)}${ANSI.RESET}`;
}

/** Màu ANSI cho tỷ lệ */
function _pctColor(pct) {
  if (pct >= 80) return ANSI.GREEN;
  if (pct >= 50) return ANSI.YELLOW;
  return ANSI.RED;
}

/** Đệm chuỗi bên phải */
function _pad(str, len) {
  // Tính kí tự hiển thị (bỏ escape ANSI)
  const visible = str.replace(/\x1b\[[0-9;]*m/g, '');
  const diff = len - visible.length;
  return diff > 0 ? str + ' '.repeat(diff) : str;
}

// ─── Duration helpers ────────────────────────────────────────────────────────
function _durationStr(start, end) {
  if (!start || !end) return '';
  const diff = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (diff <= 0) return '';
  return formatDuration(diff);
}

function _runningDurationStr(start) {
  if (!start) return '';
  const diff = Math.floor((Date.now() - new Date(start).getTime()) / 1000);
  if (diff <= 0) return '';
  return formatDuration(diff);
}

// ─── Sort helper ─────────────────────────────────────────────────────────────
/** Sắp xếp mảng điểm danh: mới nhất lên đầu (checked_in_at DESC) */
function _sortAttended(attended) {
  return [...attended].sort((a, b) => {
    const tA = a.checked_in_at ? new Date(a.checked_in_at).getTime() : 0;
    const tB = b.checked_in_at ? new Date(b.checked_in_at).getTime() : 0;
    return tB - tA;
  });
}

// ─── Member list (outside codeblock — keep Discord formatting) ───────────────
function _buildGroups(slice, guild, phaiRoleIds, emojiMap) {
  const groups = { tham_gia: [], tre: [], khong_tham_gia: [], co_phep: [] };
  for (const a of slice) {
    const member = guild?.members?.cache?.get(a.user_id);
    const name   = member?.displayName ?? `<@${a.user_id}>`;
    const phaiIcons = (phaiRoleIds ?? [])
      .filter(rid => member?.roles?.cache?.has(rid))
      .map(rid => getPhaiIcon(rid, phaiRoleIds, guild, emojiMap))
      .join('');
    const time = a.checked_in_at ? ` <t:${Math.floor(new Date(a.checked_in_at).getTime() / 1000)}:R>` : '';
    groups[a.status]?.push(`  **${name}**${phaiIcons ? ` ${phaiIcons}` : ''}${time}`);
  }
  return groups;
}

function _groupedList(groups) {
  const parts = [];
  if (groups.tham_gia.length) parts.push(`────────────────\n✅ Đúng giờ:\n${groups.tham_gia.join('\n')}`);
  if (groups.tre.length) parts.push(`────────────────\n⏰ Trễ:\n${groups.tre.join('\n')}`);
  if (groups.co_phep.length) parts.push(`────────────────\n📋 Có phép:\n${groups.co_phep.join('\n')}`);
  if (groups.khong_tham_gia.length) parts.push(`────────────────\n❌ Vắng:\n${groups.khong_tham_gia.join('\n')}`);
  return parts;
}

// ─── Phái stats (ANSI 2-column codeblock) ────────────────────────────────────
/**
 * Tạo bảng phái dạng ANSI 2 cột.
 * attendanceRoleId: Nếu có, chỉ đếm thành viên đồng thời sở hữu role này.
 */
function _phaiStatsAnsi(phaiRoleIds, guild, attended, eligibleSet, attendanceRoleId) {
  const items = [];
  for (const roleId of (phaiRoleIds ?? [])) {
    const role = guild?.roles?.cache?.get(roleId);
    if (!role) continue;
    let roleMembers = [...role.members.keys()].filter(id => eligibleSet.size === 0 || eligibleSet.has(id));
    // [FIX] Chỉ đếm những người đồng thời có role điểm danh
    if (attendanceRoleId) {
      roleMembers = roleMembers.filter(id => {
        const m = guild.members?.cache?.get(id);
        return m?.roles?.cache?.has(attendanceRoleId);
      });
    }
    const rPresent = attended.filter(a =>
      roleMembers.includes(a.user_id) && ['tham_gia', 'tre'].includes(a.status)
    ).length;
    const name = role.name.length > 10 ? role.name.slice(0, 9) + '…' : role.name;
    items.push({ name, rPresent });
  }
  if (!items.length) return null;

  // Chia thành 2 cột
  const lines = [];
  for (let i = 0; i < items.length; i += 2) {
    const left = items[i];
    const right = items[i + 1];
    const lName  = _pad(left.name, 10);
    const lColor = left.rPresent > 0 ? ANSI.GREEN : ANSI.GREY;
    const lNum   = `${lColor}${left.rPresent}${ANSI.RESET}`;
    let line = `${lName}: ${lNum}`;
    if (right) {
      const rName  = _pad(right.name, 10);
      const rColor = right.rPresent > 0 ? ANSI.GREEN : ANSI.GREY;
      const rNum   = `${rColor}${right.rPresent}${ANSI.RESET}`;
      line += `  |  ${rName}: ${rNum}`;
    }
    lines.push(line);
  }
  return '```ansi\n' + lines.join('\n') + '\n```';
}

// Phái stats dạng text thường (fallback cho các embed cũ)
function _phaiStats(phaiRoleIds, guild, attended, eligibleSet, emojiMap, attendanceRoleId) {
  const lines = [];
  for (const roleId of (phaiRoleIds ?? [])) {
    const role = guild?.roles?.cache?.get(roleId);
    if (!role) continue;
    let roleMembers = [...role.members.keys()].filter(id => eligibleSet.size === 0 || eligibleSet.has(id));
    // [FIX] Chỉ đếm những người đồng thời có role điểm danh
    if (attendanceRoleId) {
      roleMembers = roleMembers.filter(id => {
        const m = guild.members?.cache?.get(id);
        return m?.roles?.cache?.has(attendanceRoleId);
      });
    }
    const rPresent = attended.filter(a =>
      roleMembers.includes(a.user_id) && ['tham_gia', 'tre'].includes(a.status)
    ).length;
    const icon = getPhaiIcon(roleId, phaiRoleIds, guild, emojiMap);
    lines.push(`${icon} **${role.name}**: ${rPresent}`);
  }
  return lines;
}

// ─── Pending view (chưa mở) ──────────────────────────────────────────────────
function _buildPendingView(guild, session, phaiRoleIds = [], emojiMap = null) {
  const ch = session.channel_id ? `<#${session.channel_id}>` : '_Chưa có kênh_';
  const eligibleCount = session.eligible_member_ids?.length ?? 0;
  const startTs = session.started_at ? Math.floor(new Date(session.started_at).getTime() / 1000) : 0;
  const description = session.description;

  const infoLines = [`▸ ${ch}`];
  if (eligibleCount > 0) infoLines.push(`▸ **${eligibleCount}** người đủ điều kiện`);
  if (description) infoLines.push(`▸ _${description}_`);

  const embed = new EmbedBuilder()
    .setColor(COLORS.NEUTRAL)
    .setAuthor(buildAuthor(guild))
    .setTitle(`🕐 Chờ mở — ${session.session_name ?? 'Kỳ'}`)
    .setDescription([
      `Kỳ sẽ mở <t:${startTs}:R>`,
      '',
      `📅 **Thông tin Kỳ**`,
      ...infoLines,
    ].join('\n'))
    .setFooter({ text: `${FOOTER_DEFAULT} · Chưa mở` })
    .setTimestamp();

  return { embed, components: [], totalPages: 1 };
}

// ─── MAIN: buildSessionEmbed ─────────────────────────────────────────────────
function buildSessionEmbed(guild, session, attended = [], phaiRoleIds = [], _isEditing = false, page = 1, emojiMap = null, showPhaiStats = false) {
  if (!session.is_active) {
    return _buildPendingView(guild, session, phaiRoleIds, emojiMap);
  }

  // Sắp xếp mới nhất lên đầu
  const sortedAttended = _sortAttended(attended);

  const total   = sortedAttended.length;
  const joined  = sortedAttended.filter(a => a.status === 'tham_gia' || a.status === 'tre').length;
  const late    = sortedAttended.filter(a => a.status === 'tre').length;
  const absent  = sortedAttended.filter(a => a.status === 'khong_tham_gia').length;
  const excused = sortedAttended.filter(a => a.status === 'co_phep').length;
  const onTime  = joined - late;
  const pct     = total > 0 ? Math.round(joined / total * 100) : 0;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const clampedPage = Math.max(1, Math.min(page, totalPages));
  const slice = sortedAttended.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const groups = _buildGroups(slice, guild, phaiRoleIds, emojiMap);
  const lines = _groupedList(groups);

  const startTs  = Math.floor(new Date(session.started_at ?? Date.now()).getTime() / 1000);
  const ch       = session.channel_id ? `<#${session.channel_id}>` : '_Chưa có kênh_';
  const startedBy = session.started_by ? `<@${session.started_by}>` : '';
  const eligibleCount = session.eligible_member_ids?.length ?? 0;
  const color = pct >= 80 ? COLORS.GREEN : pct >= 50 ? COLORS.YELLOW : COLORS.RED;
  const runningDur = _runningDurationStr(session.started_at);

  // ── Build ANSI Dashboard description ──────────────────────────────────────
  const pctC = _pctColor(pct);
  const ansiLines = [
    `${ANSI.CYAN}⚔️ ${session.session_name ?? 'Kỳ'}${ANSI.RESET}`,
  ];
  if (runningDur) {
    ansiLines.push(`${ANSI.GREY}⏱️ Đang diễn ra: ${runningDur}${ANSI.RESET}`);
  }
  ansiLines.push('');
  ansiLines.push(`${pctC}${pctEmoji(pct)} ${pct}% — ${pctLabel(pct)}${ANSI.RESET}`);
  ansiLines.push(_ansiBar(pct, 30));
  ansiLines.push('');
  ansiLines.push(
    `${ANSI.GREEN}✅ Đúng giờ: ${String(onTime).padEnd(4)}${ANSI.RESET}  ` +
    `${ANSI.YELLOW}⏰ Trễ: ${String(late).padEnd(4)}${ANSI.RESET}  ` +
    `${ANSI.RED}❌ Vắng: ${String(absent).padEnd(4)}${ANSI.RESET}`
  );
  ansiLines.push(
    `${ANSI.MAGENTA}📋 Có phép: ${String(excused).padEnd(4)}${ANSI.RESET}  ` +
    `${ANSI.CYAN}📊 Tổng: ${String(total).padEnd(4)}${ANSI.RESET}`
  );

  const ansiBlock = '```ansi\n' + ansiLines.join('\n') + '\n```';

  // Thông tin kỳ bên ngoài codeblock (để dùng mention)
  const infoLines = [
    `📅 ${ch} · <t:${startTs}:R>${startedBy ? ` · bởi ${startedBy}` : ''}`,
  ];
  if (eligibleCount > 0) {
    infoLines.push(`▸ **${total}/${eligibleCount}** đã điểm danh`);
  }
  if (session.description) {
    infoLines.push(`▸ _${session.description}_`);
  }

  const desc = ansiBlock + '\n' + infoLines.join('\n');

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor(buildAuthor(guild))
    .setTitle(`⚔️ Điểm danh Bang Chiến`)
    .setDescription(desc)
    .setFooter({ text: `${FOOTER_DEFAULT} · Cập nhật lúc` })
    .setTimestamp();

  const firstPhaiId = phaiRoleIds?.[0];
  if (firstPhaiId) {
    const thumbUrl = buildPublicUrl(guild?.id, firstPhaiId);
    if (thumbUrl) embed.setThumbnail(thumbUrl);
  }

  // ── Phái stats field (ANSI 2-column) ─────────────────────────────────────
  if (showPhaiStats) {
    const safeEligible = session.eligible_member_ids ?? [];
    const eligibleSet = new Set(safeEligible.map ? safeEligible.map(m => m.id ?? m) : []);
    const attendanceRoleId = session.allowed_role_id ?? null;
    const phaiBlock = _phaiStatsAnsi(phaiRoleIds, guild, sortedAttended, eligibleSet, attendanceRoleId);
    if (phaiBlock) {
      embed.addFields({ name: '⚔️ Phân bố Phái', value: phaiBlock, inline: false });
    }
  }

  // ── Auto-close countdown ─────────────────────────────────────────────────
  if (session.auto_close_at) {
    const msLeft = new Date(session.auto_close_at).getTime() - Date.now();
    if (msLeft > 0) {
      embed.addFields({
        name: '⏳ Tự động đóng',
        value: `<t:${Math.floor(new Date(session.auto_close_at).getTime() / 1000)}:R>`,
        inline: false,
      });
    }
  }

  // ── Member list field (normal Discord text — keep emoji/mention) ──────────
  const listTitle = total > 0
    ? `📋 Danh sách (${total}${totalPages > 1 ? ` · trang ${clampedPage}/${totalPages}` : ''})`
    : '📋 Danh sách';
  const listValue = lines.length
    ? lines.join('\n')
    : `_Chưa có ai điểm danh — Hãy chọn trạng thái từ menu bên dưới để tham gia._`;
  embed.addFields({ name: listTitle, value: listValue, inline: false });

  // ── Pagination buttons ────────────────────────────────────────────────────
  const components = [];
  if (totalPages > 1) {
    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`attend_view:prev:${clampedPage}`)
          .setLabel('◀ Trước').setStyle(ButtonStyle.Secondary)
          .setDisabled(clampedPage <= 1),
        new ButtonBuilder()
          .setCustomId(`attend_view:next:${clampedPage}`)
          .setLabel('Sau ▶').setStyle(ButtonStyle.Secondary)
          .setDisabled(clampedPage >= totalPages),
      )
    );
  }

  return { embed, components, totalPages };
}

// ─── Closed session embed ────────────────────────────────────────────────────
function buildClosedSessionEmbed(session, attended = [], _guild, phaiRoleIds = [], emojiMap = null) {
  // Sắp xếp mới nhất lên đầu
  const sortedAttended = _sortAttended(attended);

  const total   = sortedAttended.length;
  const joined  = sortedAttended.filter(a => a.status === 'tham_gia' || a.status === 'tre').length;
  const late    = sortedAttended.filter(a => a.status === 'tre').length;
  const absent  = sortedAttended.filter(a => a.status === 'khong_tham_gia').length;
  const excused = sortedAttended.filter(a => a.status === 'co_phep').length;
  const onTime  = joined - late;
  const pct     = total > 0 ? Math.round(joined / total * 100) : 0;
  const color   = pct >= 80 ? COLORS.GREEN : pct >= 50 ? COLORS.YELLOW : COLORS.RED;

  const startedBy = session?.started_by ? `<@${session.started_by}>` : '';
  const ch        = session?.channel_id ? `<#${session.channel_id}>` : '';
  const startTs   = session?.started_at ? Math.floor(new Date(session.started_at).getTime() / 1000) : 0;
  const endTs     = session?.ended_at ? Math.floor(new Date(session.ended_at).getTime() / 1000) : 0;
  const duration  = _durationStr(session?.started_at, session?.ended_at);

  const infoLines = [
    `${ch}${startedBy ? ` · bởi ${startedBy}` : ''}`,
    `<t:${startTs}:f>${endTs ? ` → <t:${endTs}:t>` : ''}${duration ? ` · ⏱ ${duration}` : ''}`,
  ].filter(Boolean);

  // ANSI stats block
  const pctC = _pctColor(pct);
  const ansiLines = [
    `${pctC}${pctEmoji(pct)} ${pct}% — ${pctLabel(pct)}${ANSI.RESET}`,
    _ansiBar(pct, 20),
    '',
    `${ANSI.GREEN}✅ Đúng giờ: ${String(onTime).padEnd(4)}${ANSI.RESET}  ` +
    `${ANSI.YELLOW}⏰ Trễ: ${String(late).padEnd(4)}${ANSI.RESET}  ` +
    `${ANSI.RED}❌ Vắng: ${String(absent).padEnd(4)}${ANSI.RESET}`,
    `${ANSI.MAGENTA}📋 Có phép: ${String(excused).padEnd(4)}${ANSI.RESET}  ` +
    `${ANSI.CYAN}📊 Tổng: ${String(total).padEnd(4)}${ANSI.RESET}`,
  ];
  const ansiBlock = '```ansi\n' + ansiLines.join('\n') + '\n```';

  // Phái stats
  const safeEligible = session?.eligible_member_ids ?? [];
  const eligibleSet = new Set(safeEligible.map ? safeEligible.map(m => m.id ?? m) : []);
  const attendanceRoleId = session?.allowed_role_id ?? null;
  const phaiBlock = _phaiStatsAnsi(phaiRoleIds, _guild, sortedAttended, eligibleSet, attendanceRoleId);

  // First 5 attendees
  const top = sortedAttended.slice(0, 5);
  const groups = _buildGroups(top, _guild, phaiRoleIds, emojiMap);
  const memberLines = _groupedList(groups);
  if (sortedAttended.length > 5) memberLines.push(`_... và ${sortedAttended.length - 5} người khác_`);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor(buildAuthor(_guild))
    .setTitle(`${ICONS.SESSION_CLOSED} Đã kết thúc — ${session?.session_name ?? 'Kỳ'}`)
    .setDescription([
      ...infoLines,
      '',
      ansiBlock,
    ].join('\n'));

  if (phaiBlock) {
    embed.addFields({ name: '⚔️ Phân bố Phái', value: phaiBlock, inline: false });
  }

  if (memberLines.length) {
    embed.addFields({ name: '📋 Thành viên', value: memberLines.join('\n'), inline: false });
  }

  embed
    .setFooter({ text: `${FOOTER_DEFAULT} · Đã đóng` })
    .setTimestamp();

  return embed;
}

module.exports = { buildSessionEmbed, buildClosedSessionEmbed };
