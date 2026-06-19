'use strict';
const { EmbedBuilder } = require('discord.js');
const {
  COLORS, ICONS, FOOTER_DEFAULT,
  pctEmoji, pctLabel, formatDuration, buildAuthor,
} = require('../_helpers');
const { getPhaiIcon } = require('../theme.js');

// ─── ANSI helpers (tương tự sessionView) ─────────────────────────────────────
const ANSI = {
  RESET:   '\x1b[0m',
  GREEN:   '\x1b[1;32m',
  YELLOW:  '\x1b[1;33m',
  RED:     '\x1b[1;31m',
  CYAN:    '\x1b[1;36m',
  MAGENTA: '\x1b[1;35m',
  GREY:    '\x1b[1;30m',
};

function _progressBar(pct, len = 10) {
  const filled = Math.round(pct / 100 * len);
  return '▰'.repeat(filled) + '▱'.repeat(len - filled);
}

function _ansiBar(pct, len = 10) {
  const color = pct >= 80 ? ANSI.GREEN : pct >= 50 ? ANSI.YELLOW : ANSI.RED;
  return `${color}${_progressBar(pct, len)}${ANSI.RESET}`;
}

function _pctColor(pct) {
  if (pct >= 80) return ANSI.GREEN;
  if (pct >= 50) return ANSI.YELLOW;
  return ANSI.RED;
}

function _pad(str, len) {
  const visible = str.replace(/\x1b\[[0-9;]*m/g, '');
  const diff = len - visible.length;
  return diff > 0 ? str + ' '.repeat(diff) : str;
}

function _durationStr(start, end) {
  if (!start || !end) return '';
  const diff = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
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

/** Phái stats ANSI 2 cột (lọc theo attendance role) */
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
    const rTotal = roleMembers.length;
    const rPresent = attended.filter(a =>
      roleMembers.includes(a.user_id) && ['tham_gia', 'tre'].includes(a.status)
    ).length;
    const rPct = rTotal > 0 ? Math.round(rPresent / rTotal * 100) : 0;
    const name = role.name.length > 10 ? role.name.slice(0, 9) + '…' : role.name;
    items.push({ name, rPresent, rTotal, rPct });
  }
  if (!items.length) return null;

  const lines = [];
  for (let i = 0; i < items.length; i += 2) {
    const left = items[i];
    const right = items[i + 1];
    const lName = _pad(left.name, 10);
    const lNum  = `${String(left.rPresent).padStart(2)}/${left.rTotal}`;
    const lBar  = _ansiBar(left.rPct, 6);
    let line = `${lName}: [${lNum}] ${lBar}`;
    if (right) {
      const rName = _pad(right.name, 10);
      const rNum  = `${String(right.rPresent).padStart(2)}/${right.rTotal}`;
      const rBar  = _ansiBar(right.rPct, 6);
      line += `  |  ${rName}: [${rNum}] ${rBar}`;
    }
    lines.push(line);
  }
  return '```ansi\n' + lines.join('\n') + '\n```';
}

function buildSummaryEmbed(session, attended = [], guild, phai_role_ids = [], emojiMap = null) {
  const sortedAttended = _sortAttended(attended);

  const total   = sortedAttended.length;
  const joined  = sortedAttended.filter(a => a.status === 'tham_gia' || a.status === 'tre').length;
  const absent  = sortedAttended.filter(a => a.status === 'khong_tham_gia').length;
  const excused = sortedAttended.filter(a => a.status === 'co_phep').length;
  const late    = sortedAttended.filter(a => a.status === 'tre').length;
  const onTime  = joined - late;
  const pct     = total > 0 ? Math.round(joined / total * 100) : 0;
  const color   = pct >= 80 ? COLORS.GREEN : pct >= 50 ? COLORS.YELLOW : COLORS.RED;

  const eligibleCount = session?.eligible_member_ids?.length ?? 0;
  const eligibleSet   = new Set((session.eligible_member_ids ?? []).map(m => m.id ?? m));
  const startedBy     = session?.started_by ? `<@${session.started_by}>` : '';
  const ch            = session?.channel_id ? `<#${session.channel_id}>` : '';
  const startTs       = session?.started_at ? Math.floor(new Date(session.started_at).getTime() / 1000) : 0;
  const endTs         = session?.ended_at ? Math.floor(new Date(session.ended_at).getTime() / 1000) : 0;
  const duration      = _durationStr(session?.started_at, session?.ended_at);
  const attendanceRoleId = session?.allowed_role_id ?? null;

  // Session info
  const infoParts = [];
  if (ch) infoParts.push(`▸ ${ch}${startedBy ? ` · bởi ${startedBy}` : ''}`);
  if (duration) {
    infoParts.push(`▸ ⏱ ${duration}`);
  }
  if (eligibleCount > 0) {
    infoParts.push(`▸ **${total}/${eligibleCount}** đã điểm danh`);
  }
  if (session?.description) {
    infoParts.push(`▸ _${session.description}_`);
  }

  // ANSI stats block
  const pctC = _pctColor(pct);
  const ansiLines = [
    `${pctC}${pctEmoji(pct)} Tỉ lệ tham gia: ${pct}% — ${pctLabel(pct)}${ANSI.RESET}`,
    _ansiBar(pct, 20),
    '',
    `${ANSI.GREEN}✅ Đúng giờ: ${String(onTime).padEnd(4)}${ANSI.RESET}  ` +
    `${ANSI.YELLOW}⏰ Trễ: ${String(late).padEnd(4)}${ANSI.RESET}  ` +
    `${ANSI.RED}❌ Vắng: ${String(absent).padEnd(4)}${ANSI.RESET}`,
    `${ANSI.MAGENTA}📋 Có phép: ${String(excused).padEnd(4)}${ANSI.RESET}  ` +
    `${ANSI.CYAN}📊 Tổng: ${String(total).padEnd(4)}${ANSI.RESET}`,
  ];
  const ansiBlock = '```ansi\n' + ansiLines.join('\n') + '\n```';

  // MVP: first to check in
  const joinedSorted = sortedAttended
    .filter(a => a.checked_in_at && (a.status === 'tham_gia' || a.status === 'tre'));
  // MVP is the EARLIEST check-in (last in our DESC sorted list)
  const firstAttendee = joinedSorted.length ? joinedSorted[joinedSorted.length - 1] : null;
  let highlightLine = '';
  if (firstAttendee) {
    const mvpMember = guild?.members?.cache?.get(firstAttendee.user_id);
    const mvpName = mvpMember?.displayName ?? `<@${firstAttendee.user_id}>`;
    highlightLine = `🏆 **MVP**: ${mvpName} — điểm danh đầu tiên`;
  }

  // Top 20 attendees (member list)
  const top = sortedAttended.slice(0, 20);
  const groups = { tham_gia: [], tre: [], khong_tham_gia: [], co_phep: [] };
  for (const a of top) {
    const member = guild?.members?.cache?.get(a.user_id);
    const name   = member?.displayName ?? `<@${a.user_id}>`;
    const phaiIcons = (phai_role_ids ?? [])
      .filter(rid => member?.roles?.cache?.has(rid))
      .map(rid => getPhaiIcon(rid, phai_role_ids, guild, emojiMap))
      .join('');
    groups[a.status]?.push(`  **${name}**${phaiIcons ? ` ${phaiIcons}` : ''}`);
  }
  const memberLines = [];
  if (groups.tham_gia.length) memberLines.push(`────────────────\n✅ Đúng giờ:\n${groups.tham_gia.join('\n')}`);
  if (groups.tre.length) memberLines.push(`────────────────\n⏰ Trễ:\n${groups.tre.join('\n')}`);
  if (groups.co_phep.length) memberLines.push(`────────────────\n📋 Có phép:\n${groups.co_phep.join('\n')}`);
  if (groups.khong_tham_gia.length) memberLines.push(`────────────────\n❌ Vắng:\n${groups.khong_tham_gia.join('\n')}`);
  if (sortedAttended.length > 20) memberLines.push(`_... và ${sortedAttended.length - 20} người khác_`);

  // Phái stats
  const phaiBlock = _phaiStatsAnsi(phai_role_ids, guild, sortedAttended, eligibleSet, attendanceRoleId);

  const desc = [
    ...(highlightLine ? [highlightLine, ''] : []),
    ...infoParts,
    '',
    ansiBlock,
  ].join('\n');

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor(buildAuthor(guild))
    .setTitle(`📊 Tổng kết — ${session?.session_name ?? 'Kỳ điểm danh'}`)
    .setDescription(desc);

  if (phaiBlock) {
    embed.addFields({ name: '⚔️ Phân bố Phái', value: phaiBlock, inline: false });
  }

  if (memberLines.length) {
    embed.addFields({ name: '📋 Chi tiết', value: memberLines.join('\n'), inline: false });
  } else {
    embed.addFields({ name: '📋 Chi tiết', value: '> _Không có ai tham gia Kỳ này._\n> 💡 Hãy nhắc nhở mọi người điểm danh đúng giờ ở các Kỳ sau.', inline: false });
  }

  embed
    .setFooter({ text: `${FOOTER_DEFAULT} · Tổng ${total} người` })
    .setTimestamp();

  return embed;
}

module.exports = { buildSummaryEmbed };
