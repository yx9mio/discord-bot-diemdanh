'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {
  COLORS, FOOTER_DEFAULT,
  formatDuration, buildAuthor,
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

/**
 * [UX-P3] Màu embed theo trạng thái phiên (không theo % tham gia):
 *   xanh đang mở · vàng sắp tự đóng (≤10 phút) · xám đã đóng · đỏ đã hủy
 */
function sessionEmbedColor(session) {
  if (session?.cancelled) return COLORS.RED;
  if (!session?.is_active) return COLORS.GREY;
  if (session.auto_close_at) {
    const msLeft = new Date(session.auto_close_at).getTime() - Date.now();
    if (msLeft > 0 && msLeft <= 10 * 60 * 1000) return COLORS.YELLOW;
  }
  return COLORS.GREEN;
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

/** Phái stats dạng text thường + Discord custom emoji — [UX-P3] thay thế hoàn toàn ANSI */
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.max(1, Math.min(page, totalPages));
  const slice = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const groups = _buildGroups(slice, guild, phaiRoleIds, emojiMap);
  const lines = _groupedList(groups);

  const eligibleCount    = session.eligible_member_ids?.length ?? 0;
  const eligibleSet      = new Set((session.eligible_member_ids ?? []).map(m => m.id ?? m));
  const runningDur       = _durationStr(session.started_at, session.ended_at ?? null);
  const attendanceRoleId = session.allowed_role_id ?? null;

  // ── Description — plain text, mobile-first ([UX-P3] bỏ ANSI hoàn toàn) ─────
  const descParts = [];
  if (opts.userLine) descParts.push(opts.userLine, '');
  if (session.is_active) {
    if (session.auto_close_at) {
      const autoCloseTs = Math.floor(new Date(session.auto_close_at).getTime() / 1000);
      descParts.push(`⏱️ Tự đóng <t:${autoCloseTs}:R>`);
    } else if (runningDur) {
      descParts.push(`⏱️ Đang diễn ra: ${runningDur}`);
    }
  } else {
    const endTs = session.ended_at ? Math.floor(new Date(session.ended_at).getTime() / 1000) : null;
    descParts.push(endTs ? `🔒 Đóng lúc <t:${endTs}:f>` : '🔒 Đã kết thúc');
  }
  descParts.push(`✅ Đúng giờ ${onTime} · ⏰ Trễ ${late} · ❌ Vắng ${absent} · 📋 Có phép ${excused}`);

  const infoParts = [];
  if (eligibleCount > 0) {
    infoParts.push(`▸ 🎯 Mục tiêu: **${total}/${eligibleCount}** thành viên`);
  }
  if (session.description) {
    infoParts.push(`▸ _${session.description}_`);
  }

  const desc = [
    ...descParts,
    ...(infoParts.length ? ['', ...infoParts] : []),
  ].join('\n');

  const color = sessionEmbedColor(session);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor(buildAuthor(guild))
    .setTitle(`⚔️ ${session.session_name ?? 'Kỳ điểm danh'}`)
    .setDescription(desc)
    .setFooter({ text: `${FOOTER_DEFAULT} · ${session.is_active ? 'Đang diễn ra' : 'Đã kết thúc'}` })
    .setTimestamp();

  // ── Thumbnail ─────────────────────────────────────────────────────────────
  const thumbUrl = _topPhaiThumbnail(phaiRoleIds, guild, sortedAttended, emojiMap);
  if (thumbUrl) embed.setThumbnail(thumbUrl);

  // ── Phái stats field (plain text — luôn) ──────────────────────────────────
  if (showPhaiStats && phaiRoleIds?.length) {
    const phaiBlock = _phaiStatsText(phaiRoleIds, guild, sortedAttended, eligibleSet, attendanceRoleId, emojiMap);
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

  const cancelled = !!session?.cancelled;
  const color     = cancelled ? COLORS.RED : COLORS.GREY;
  const endTs     = session?.ended_at ? Math.floor(new Date(session.ended_at).getTime() / 1000) : null;

  const eligibleSet = new Set((session?.eligible_member_ids ?? []).map(m => m.id ?? m));
  const attendanceRoleId = session?.allowed_role_id ?? null;
  const phaiBlock = _phaiStatsText(phaiRoleIds, _guild, sortedAttended, eligibleSet, attendanceRoleId, emojiMap);

  const descLines = [];
  descLines.push(endTs
    ? `${cancelled ? '🗑️' : '🔒'} ${cancelled ? 'Đã hủy' : 'Đóng'} lúc <t:${endTs}:f>`
    : (cancelled ? '🗑️ Đã hủy' : '🔒 Đã kết thúc'));
  descLines.push(`**Tỉ lệ tham gia**: \`${pct}%\` (${joined}/${total})`);
  descLines.push(`✅ Đúng giờ \`${onTime}\` · ⏰ Trễ \`${late}\` · ❌ Vắng \`${absent}\` · 📋 Có phép \`${excused}\` · 📊 Tổng \`${total}\``);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor(buildAuthor(_guild))
    .setTitle(`${cancelled ? '🗑️ Đã hủy' : '🔴 Đã kết thúc'} — ${session?.session_name ?? 'Kỳ điểm danh'}`)
    .setDescription(descLines.join('\n'));

  if (phaiBlock) {
    embed.addFields({ name: '⚔️ Phân bố Phái', value: phaiBlock, inline: false });
  }

  embed
    .setFooter({ text: `${FOOTER_DEFAULT} · ${cancelled ? 'Đã hủy' : 'Đã đóng'}` })
    .setTimestamp();

  const thumbUrl = _topPhaiThumbnail(phaiRoleIds, _guild, sortedAttended, emojiMap);
  if (thumbUrl) embed.setThumbnail(thumbUrl);

  return embed;
}

module.exports = { buildSessionEmbed, buildClosedSessionEmbed, sessionEmbedColor };
