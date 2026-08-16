'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {
  COLORS, ICONS, FOOTER_DEFAULT,
  pctEmoji, pctLabel, formatDuration, buildAuthor,
} = require('../_helpers');
const { getPhaiIcon } = require('../theme.js');
const { buildPublicUrl } = require('../phaiIcons.js');

const PAGE_SIZE = 15;

/** Nhãn hiển thị cho filter trạng thái trong view danh sách */
const FILTER_LABELS = {
  tham_gia:       '✅ Đúng giờ',
  tre:            '⏰ Trễ',
  khong_tham_gia: '❌ Vắng',
  co_phep:        '📋 Có phép',
};

// ─── ANSI helpers ────────────────────────────────────────────────────────────
const ANSI = {
  RESET:   '\x1b[0m',
  GREEN:   '\x1b[1;32m',
  YELLOW:  '\x1b[1;33m',
  RED:     '\x1b[1;31m',
  CYAN:    '\x1b[1;36m',
  MAGENTA: '\x1b[1;35m',
  GREY:    '\x1b[1;30m',
};

/** Thanh tiến độ ASCII 10 kí tự */
function _progressBar(pct, len = 10) {
  const filled = Math.round(pct / 100 * len);
  return '▰'.repeat(filled) + '▱'.repeat(len - filled);
}

/** Thanh tiến độ tô màu ANSI theo ngưỡng */
function _ansiBar(pct, len = 10) {
  const color = pct >= 80 ? ANSI.GREEN : pct >= 50 ? ANSI.YELLOW : ANSI.RED;
  return `${color}${_progressBar(pct, len)}${ANSI.RESET}`;
}

/** Màu ANSI tương ứng tỉ lệ */
function _pctColor(pct) {
  if (pct >= 80) return ANSI.GREEN;
  if (pct >= 50) return ANSI.YELLOW;
  return ANSI.RED;
}

/** Đệm chuỗi bên phải */
function _pad(str, len) {
  // Tính kí tự hiển thị (bỏ escape ANSI)
  const visible = str.replace(/\x1b\[[0-9;]*m/g, ''); // eslint-disable-line no-control-regex
  const diff = len - visible.length;
  return diff > 0 ? str + ' '.repeat(diff) : str;
}

/** Chuỗi thời gian đã diễn ra */
function _durationStr(start, end) {
  if (!start) return '';
  const endTime = end ? new Date(end).getTime() : Date.now();
  const diff = Math.floor((endTime - new Date(start).getTime()) / 1000);
  if (diff <= 0) return '';
  return formatDuration(diff);
}

/** Sắp xếp mới nhất lên đầu */
function _sortAttended(attended) {
  return [...attended].sort((a, b) => {
    const tA = a.checked_in_at ? new Date(a.checked_in_at).getTime() : 0;
    const tB = b.checked_in_at ? new Date(b.checked_in_at).getTime() : 0;
    return tB - tA;
  });
}

/** Gom nhóm theo trạng thái */
function _buildGroups(slice, guild, phaiRoleIds, emojiMap) {
  const groups = { tham_gia: [], tre: [], khong_tham_gia: [], co_phep: [] };
  for (const a of slice) {
    const member = guild?.members?.cache?.get(a.user_id);
    const name   = member?.displayName ?? `<@${a.user_id}>`;
    const phaiIcons = (phaiRoleIds ?? [])
      .filter(rid => member?.roles?.cache?.has(rid))
      .map(rid => getPhaiIcon(rid, phaiRoleIds, guild, emojiMap))
      .join('');
    groups[a.status]?.push(`  **${name}**${phaiIcons ? ` ${phaiIcons}` : ''}`);
  }
  return groups;
}

/** Render danh sách thành viên grouped */
function _groupedList(groups) {
  const lines = [];
  if (groups.tham_gia.length)       lines.push(`────────────────\n✅ Đúng giờ:\n${groups.tham_gia.join('\n')}`);
  if (groups.tre.length)            lines.push(`────────────────\n⏰ Trễ:\n${groups.tre.join('\n')}`);
  if (groups.co_phep.length)        lines.push(`────────────────\n📋 Có phép:\n${groups.co_phep.join('\n')}`);
  if (groups.khong_tham_gia.length) lines.push(`────────────────\n❌ Vắng:\n${groups.khong_tham_gia.join('\n')}`);
  return lines;
}

/** Phái stats dạng ANSI 2 cột (lọc theo attendance role nếu có) */
function _phaiStatsAnsi(phaiRoleIds, guild, attended, eligibleSet, attendanceRoleId) {
  const items = [];
  for (const roleId of (phaiRoleIds ?? [])) {
    const role = guild?.roles?.cache?.get(roleId);
    if (!role) continue;
    let roleMembers = [...role.members.keys()].filter(id => eligibleSet.size === 0 || eligibleSet.has(id));
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

/** Phái stats dạng text thường + Discord custom emoji (cho view chỉnh sửa) */
function _phaiStatsText(phaiRoleIds, guild, attended, eligibleSet, attendanceRoleId, emojiMap = null) {
  const items = [];
  for (const roleId of (phaiRoleIds ?? [])) {
    const role = guild?.roles?.cache?.get(roleId);
    if (!role) continue;
    let roleMembers = [...role.members.keys()].filter(id => eligibleSet.size === 0 || eligibleSet.has(id));
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
    const name = role.name.length > 10 ? role.name.slice(0, 9) + '…' : role.name;
    items.push({ icon, name, rPresent });
  }
  if (!items.length) return null;

  const lines = [];
  for (let i = 0; i < items.length; i += 2) {
    const left = items[i];
    const right = items[i + 1];
    const lPart = `${left.icon} **${left.name}**: \`${left.rPresent}\``;
    const rPart = right ? `${right.icon} **${right.name}**: \`${right.rPresent}\`` : '';
    lines.push(rPart ? `${lPart}  |  ${rPart}` : lPart);
  }
  return lines.join('\n');
}

/**
 * Thumbnail icon phái có nhiều người tham gia nhất.
 * Dùng URL icon Supabase Storage nếu có, không gắn thumbnail nếu không có.
 */
function _topPhaiThumbnail(phaiRoleIds, guild, attended, emojiMap) {
  if (!phaiRoleIds?.length || !guild) return null;
  let topRoleId = null;
  let topCount = 0;
  for (const roleId of phaiRoleIds) {
    const role = guild.roles?.cache?.get(roleId);
    if (!role) continue;
    const count = attended.filter(a =>
      guild.members?.cache?.get(a.user_id)?.roles?.cache?.has(roleId) &&
      ['tham_gia', 'tre'].includes(a.status)
    ).length;
    if (count > topCount) {
      topCount = count;
      topRoleId = roleId;
    }
  }
  if (!topRoleId || topCount === 0) return null;

  // Lấy icon filename từ emojiMap
  const iconFile = emojiMap?.[topRoleId];
  if (iconFile && typeof iconFile === 'string' && iconFile.endsWith('.png')) {
    const url = buildPublicUrl(iconFile);
    if (url) return url;
  }
  return null;
}

// ─── Pending view (chưa kích hoạt) ───────────────────────────────────────────
function _buildPendingView(guild, session, phaiRoleIds = [], emojiMap = null) {
  const isCancelled = session.cancelled;
  const color = isCancelled ? COLORS.RED : COLORS.YELLOW;
  const statusLabel = isCancelled ? '🔴 ĐÃ HỦY' : '🟡 CHƯA KÍCH HOẠT';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor(buildAuthor(guild))
    .setTitle(`📋 ${session.session_name ?? 'Kỳ điểm danh'}`)
    .setDescription(
      `**Trạng thái**: \`${statusLabel}\`\n\n` +
      `> ℹ️ Phiên này ${isCancelled ? 'đã bị hủy bởi quản trị viên.' : 'chưa được kích hoạt.'}\n` +
      `> Không thể điểm danh lúc này.`
    )
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  const thumbUrl = _topPhaiThumbnail(phaiRoleIds, guild, [], emojiMap);
  if (thumbUrl) embed.setThumbnail(thumbUrl);

  return { embed, components: [], totalPages: 1 };
}

// ─── MAIN: buildSessionEmbed ─────────────────────────────────────────────────
/**
 * @param {object} guild
 * @param {object} session
 * @param {Array}  attended
 * @param {string[]} phaiRoleIds
 * @param {boolean} _isEditing
 * @param {number} page
 * @param {object|null} emojiMap
 * @param {boolean} showPhaiStats
 * @param {object} [opts]  - showList (default true), showPageSuffix (default true),
 *                            paginationPrefix (default 'attend_view'), filter ('all'|status),
 *                            allowClosed (default false — render kể cả khi phiên đã đóng),
 *                            sessionId (string), userLine (string — dòng trạng thái bản thân)
 */
function buildSessionEmbed(guild, session, attended = [], phaiRoleIds = [], _isEditing = false, page = 1, emojiMap = null, showPhaiStats = false, opts = {}) {
  if (!session.is_active && !opts.allowClosed) {
    return _buildPendingView(guild, session, phaiRoleIds, emojiMap);
  }

  // Sắp xếp mới nhất lên đầu
  const sortedAttended = _sortAttended(attended);

  const filter = opts.filter ?? 'all';
  const filtered = filter === 'all'
    ? sortedAttended
    : sortedAttended.filter(a => a.status === filter);

  const total   = sortedAttended.length;
  const joined  = sortedAttended.filter(a => a.status === 'tham_gia' || a.status === 'tre').length;
  const late    = sortedAttended.filter(a => a.status === 'tre').length;
  const absent  = sortedAttended.filter(a => a.status === 'khong_tham_gia').length;
  const excused = sortedAttended.filter(a => a.status === 'co_phep').length;
  const onTime  = joined - late;
  const pct     = total > 0 ? Math.round(joined / total * 100) : 0;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.max(1, Math.min(page, totalPages));
  const slice = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const groups = _buildGroups(slice, guild, phaiRoleIds, emojiMap);
  const lines = _groupedList(groups);

  const eligibleCount    = session.eligible_member_ids?.length ?? 0;
  const eligibleSet      = new Set((session.eligible_member_ids ?? []).map(m => m.id ?? m));
  const runningDur       = _durationStr(session.started_at, session.ended_at ?? null);
  const attendanceRoleId = session.allowed_role_id ?? null;

  // ── ANSI code block ───────────────────────────────────────────────────────
  const pctC = _pctColor(pct);
  const ansiLines = [
    `${ANSI.CYAN}⚔️ ${session.session_name ?? 'Kỳ'}${ANSI.RESET}`,
  ];
  if (session.is_active && runningDur) {
    ansiLines.push(`${ANSI.GREY}⏱️ Đang diễn ra: ${runningDur}${ANSI.RESET}`);
  }
  ansiLines.push('');
  ansiLines.push(`${pctC}${pctEmoji(pct)} Tỉ lệ tham gia: ${pct}% — ${pctLabel(pct)}${ANSI.RESET}`);
  ansiLines.push(_ansiBar(pct, 20));
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
  const ansiBlock = '```ansi\n' + ansiLines.join('\\n') + '\n```';

  // ── Info parts ────────────────────────────────────────────────────────────
  const infoParts = [];
  if (session.auto_close_at) {
    const autoCloseTs = Math.floor(new Date(session.auto_close_at).getTime() / 1000);
    infoParts.push(`▸ ⏱️ Tự động đóng: <t:${autoCloseTs}:R> (<t:${autoCloseTs}:t>)`);
  }
  if (eligibleCount > 0) {
    infoParts.push(`▸ 🎯 Mục tiêu: **${total}/${eligibleCount}** thành viên`);
  }
  if (session.description) {
    infoParts.push(`▸ _${session.description}_`);
  }

  // ── Description: userLine (trạng thái bản thân) + ANSI block + session info ──
  const desc = [
    ...(opts.userLine ? [opts.userLine, ''] : []),
    ansiBlock,
    ...(infoParts.length ? ['', ...infoParts] : []),
  ].join('\n');

  const color = pct >= 80 ? COLORS.GREEN : pct >= 50 ? COLORS.YELLOW : COLORS.RED;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor(buildAuthor(guild))
    .setTitle(`⚔️ Điểm danh — ${session.session_name ?? 'Kỳ điểm danh'}`)
    .setDescription(desc)
    .setFooter({ text: `${FOOTER_DEFAULT} · ${session.is_active ? 'Đang diễn ra' : 'Đã kết thúc'}` })
    .setTimestamp();

  // ── Thumbnail ─────────────────────────────────────────────────────────────
  const thumbUrl = _topPhaiThumbnail(phaiRoleIds, guild, sortedAttended, emojiMap);
  if (thumbUrl) embed.setThumbnail(thumbUrl);

  // ── Phái stats field ──────────────────────────────────────────────────────
  if (showPhaiStats && phaiRoleIds?.length) {
    const phaiBlock = _isEditing
      ? _phaiStatsText(phaiRoleIds, guild, sortedAttended, eligibleSet, attendanceRoleId, emojiMap)
      : _phaiStatsAnsi(phaiRoleIds, guild, sortedAttended, eligibleSet, attendanceRoleId);
    if (phaiBlock) {
      embed.addFields({ name: '⚔️ Phân bố Phái', value: phaiBlock, inline: false });
    }
  }

  // ── Member list field (normal Discord text — keep emoji/mention) ──────────
  const showList = opts.showList !== false;
  if (showList) {
    const filterLabel = filter !== 'all' ? ` · ${FILTER_LABELS[filter] ?? filter}` : '';
    const listTitle = filtered.length > 0
      ? `📋 Danh sách (${filtered.length}${filterLabel}${totalPages > 1 && opts.showPageSuffix !== false ? ` · trang ${clampedPage}/${totalPages}` : ''})`
      : `📋 Danh sách${filterLabel}`;
    const listValue = lines.length
      ? lines.join('\n')
      : filter !== 'all'
        ? `_Không có ai trong nhóm ${FILTER_LABELS[filter] ?? filter}._`
        : `_Chưa có ai điểm danh — Hãy chọn trạng thái từ menu bên dưới để tham gia._`;
    embed.addFields({ name: listTitle, value: listValue, inline: false });
  }

  // ── Pagination buttons ────────────────────────────────────────────────────
  const paginationPrefix = opts.paginationPrefix ?? 'attend_view';
  const filterSuffix = filter !== 'all' ? `:${filter}` : (opts.sessionId ? ':all' : '');
  const sessionSuffix = opts.sessionId ? `:${opts.sessionId}` : '';
  const components = [];
  if (showList && totalPages > 1) {
    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`${paginationPrefix}:prev:${clampedPage}${filterSuffix}${sessionSuffix}`)
          .setLabel('◀ Trước').setStyle(ButtonStyle.Secondary)
          .setDisabled(clampedPage <= 1),
        new ButtonBuilder()
          .setCustomId(`${paginationPrefix}:next:${clampedPage}${filterSuffix}${sessionSuffix}`)
          .setLabel('Sau ▶').setStyle(ButtonStyle.Secondary)
          .setDisabled(clampedPage >= totalPages),
      )
    );
  }

  return { embed, components, totalPages: showList ? totalPages : 1 };
}

// ─── Closed session embed ────────────────────────────────────────────────────
function buildClosedSessionEmbed(session, attended = [], _guild, phaiRoleIds = [], emojiMap = null) {
  const sortedAttended = _sortAttended(attended);
  const total   = sortedAttended.length;
  const joined  = sortedAttended.filter(a => a.status === 'tham_gia' || a.status === 'tre').length;
  const absent  = sortedAttended.filter(a => a.status === 'khong_tham_gia').length;
  const excused = sortedAttended.filter(a => a.status === 'co_phep').length;
  const late    = sortedAttended.filter(a => a.status === 'tre').length;
  const onTime  = joined - late;
  const pct     = total > 0 ? Math.round(joined / total * 100) : 0;
  const color   = pct >= 80 ? COLORS.GREEN : pct >= 50 ? COLORS.YELLOW : COLORS.RED;

  const eligibleSet = new Set((session?.eligible_member_ids ?? []).map(m => m.id ?? m));
  const attendanceRoleId = session?.allowed_role_id ?? null;
  const phaiBlock = _phaiStatsAnsi(phaiRoleIds, _guild, sortedAttended, eligibleSet, attendanceRoleId);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor(buildAuthor(_guild))
    .setTitle(`🔒 Đã đóng — ${session?.session_name ?? 'Kỳ điểm danh'}`)
    .setDescription(
      `**Tỉ lệ tham gia**: \`${pct}%\` (${joined}/${total})\n` +
      `✅ Đúng giờ: \`${onTime}\` · ⏰ Trễ: \`${late}\` · ❌ Vắng: \`${absent}\` · 📋 Có phép: \`${excused}\` · 📊 Tổng: \`${total}\``
    );

  if (phaiBlock) {
    embed.addFields({ name: '⚔️ Phân bố Phái', value: phaiBlock, inline: false });
  }

  embed
    .setFooter({ text: `${FOOTER_DEFAULT} · Đã đóng` })
    .setTimestamp();

  const thumbUrl = _topPhaiThumbnail(phaiRoleIds, _guild, sortedAttended, emojiMap);
  if (thumbUrl) embed.setThumbnail(thumbUrl);

  return embed;
}

module.exports = { buildSessionEmbed, buildClosedSessionEmbed };
