'use strict';
const { EmbedBuilder } = require('discord.js');
const {
  COLORS, ICONS, FOOTER_DEFAULT,
  buildRichProgressBar, pctEmoji, pctLabel, formatDuration, buildAuthor,
} = require('../_helpers');
const { getPhaiIcon } = require('../theme.js');

function _durationStr(start, end) {
  if (!start || !end) return '';
  const diff = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (diff <= 0) return '';
  return formatDuration(diff);
}

function buildSummaryEmbed(session, attended = [], guild, phai_role_ids = [], emojiMap = null) {
  const total   = attended.length;
  const joined  = attended.filter(a => a.status === 'tham_gia' || a.status === 'tre').length;
  const absent  = attended.filter(a => a.status === 'khong_tham_gia').length;
  const excused = attended.filter(a => a.status === 'co_phep').length;
  const late    = attended.filter(a => a.status === 'tre').length;
  const pct     = total > 0 ? Math.round(joined / total * 100) : 0;
  const bar     = buildRichProgressBar(pct);
  const color   = pct >= 80 ? COLORS.GREEN : pct >= 50 ? COLORS.YELLOW : COLORS.RED;

  const eligibleCount = session?.eligible_member_ids?.length ?? 0;
  const eligibleSet   = new Set((session.eligible_member_ids ?? []).map(m => m.id ?? m));
  const startedBy     = session?.started_by ? `<@${session.started_by}>` : '';
  const ch            = session?.channel_id ? `<#${session.channel_id}>` : '';
  const startTs       = session?.started_at ? Math.floor(new Date(session.started_at).getTime() / 1000) : 0;
  const endTs         = session?.ended_at ? Math.floor(new Date(session.ended_at).getTime() / 1000) : 0;
  const duration      = _durationStr(session?.started_at, session?.ended_at);

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

  const top = attended.slice(0, 20);
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
  const lines = [];
  if (groups.tham_gia.length) lines.push(`────────────────\n✅ Đúng giờ:\n${groups.tham_gia.join('\n')}`);
  if (groups.tre.length) lines.push(`────────────────\n⏰ Trễ:\n${groups.tre.join('\n')}`);
  if (groups.co_phep.length) lines.push(`────────────────\n📋 Có phép:\n${groups.co_phep.join('\n')}`);
  if (groups.khong_tham_gia.length) lines.push(`────────────────\n❌ Vắng:\n${groups.khong_tham_gia.join('\n')}`);
  if (attended.length > 20) lines.push(`_... và ${attended.length - 20} người khác_`);

  // Phái stats
  const phaiLines = [];
  for (const roleId of (phai_role_ids ?? [])) {
    const role = guild?.roles?.cache?.get(roleId);
    if (!role) continue;
    const roleMembers = [...role.members.keys()].filter(id => eligibleSet.size === 0 || eligibleSet.has(id));
    const rTotal = roleMembers.length;
    const rPresent = attended.filter(a =>
      roleMembers.includes(a.user_id) && ['tham_gia', 'tre'].includes(a.status)
    ).length;
    const rPct = rTotal > 0 ? Math.round(rPresent / rTotal * 100) : 0;
    const icon = getPhaiIcon(roleId, phai_role_ids, guild, emojiMap);
    const pBar = buildRichProgressBar(rPct, 6);
    phaiLines.push(`${icon} **${role.name}**: ${rPresent}/${rTotal} (${rPct}%) \`${pBar}\``);
  }

  // MVP: first to check in
  const joinedSorted = attended
    .filter(a => a.checked_in_at && (a.status === 'tham_gia' || a.status === 'tre'))
    .sort((a, b) => new Date(a.checked_in_at) - new Date(b.checked_in_at));
  const firstAttendee = joinedSorted[0];
  let highlightLine = '';
  if (firstAttendee) {
    const mvpMember = guild?.members?.cache?.get(firstAttendee.user_id);
    const mvpName = mvpMember?.displayName ?? `<@${firstAttendee.user_id}>`;
    highlightLine = `🏆 **MVP**: ${mvpName} — điểm danh đầu tiên`;
  }

  const desc = [
    ...(highlightLine ? [highlightLine, ''] : []),
    ...infoParts,
    '',
    `${pctEmoji(pct)} **Tỉ lệ tham gia: ${pct}%** — ${pctLabel(pct)}`,
    `\`${bar}\``,
  ].join('\n');

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor(buildAuthor(guild))
    .setTitle(`📊 Tổng kết — ${session?.session_name ?? 'Phiên điểm danh'}`)
    .setDescription(desc);

  const fields = [
    { name: `${ICONS.ATTEND_YES} Đúng giờ`, value: `**${joined - late}**`,  inline: true },
    { name: `${ICONS.ATTEND_LATE} Trễ`,     value: `**${late}**`,           inline: true },
    { name: `${ICONS.ATTEND_NO} Vắng`,      value: `**${absent}**`,         inline: true },
    { name: `${ICONS.ATTEND_EXCUSE} Có phép`, value: `**${excused}**`,      inline: true },
  ];
  if (eligibleCount > 0) {
    fields.push({ name: '🎯 Đạt', value: `**${pct}%**`, inline: true });
  }

  if (phaiLines.length) {
    fields.push({ name: '⚔️ Phái / Nhóm', value: phaiLines.join('\n'), inline: false });
  }

  embed.addFields(...fields);

  if (lines.length) {
    embed.addFields({ name: '📋 Chi tiết', value: lines.join('\n'), inline: false });
  } else {
    embed.addFields({ name: '📋 Chi tiết', value: '> _Không có ai tham gia phiên này._\n> 💡 Hãy nhắc nhở mọi người điểm danh đúng giờ ở các phiên sau.', inline: false });
  }

  embed
    .setFooter({ text: `${FOOTER_DEFAULT} · Tổng ${total} người` })
    .setTimestamp();

  return embed;
}

module.exports = { buildSummaryEmbed };
