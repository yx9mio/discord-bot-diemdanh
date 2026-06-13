'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {
  COLORS, ICONS, FOOTER_DEFAULT,
  buildRichProgressBar, pctEmoji, pctLabel, formatDuration, buildAuthor,
} = require('../_helpers');
const { getPhaiIcon } = require('../theme.js');
const { buildPublicUrl } = require('../phaiIcons.js');

const PAGE_SIZE = 15;

const STATUS_LABEL = {
  tham_gia:       `${ICONS.ATTEND_YES} Tham gia`,
  tre:            `${ICONS.ATTEND_LATE} Trễ`,
  khong_tham_gia: `${ICONS.ATTEND_NO} Vắng`,
  co_phep:        `${ICONS.ATTEND_EXCUSE} Có phép`,
};

function _durationStr(start, end) {
  if (!start || !end) return '';
  const diff = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (diff <= 0) return '';
  return formatDuration(diff);
}

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

function _phaiStats(phaiRoleIds, guild, attended, eligibleSet, emojiMap) {
  const lines = [];
  for (const roleId of (phaiRoleIds ?? [])) {
    const role = guild?.roles?.cache?.get(roleId);
    if (!role) continue;
    const roleMembers = [...role.members.keys()].filter(id => eligibleSet.size === 0 || eligibleSet.has(id));
    const rTotal = roleMembers.length;
    const rPresent = attended.filter(a =>
      roleMembers.includes(a.user_id) && ['tham_gia', 'tre'].includes(a.status)
    ).length;
    const rPct = rTotal > 0 ? Math.round(rPresent / rTotal * 100) : 0;
    const icon = getPhaiIcon(roleId, phaiRoleIds, guild, emojiMap);
    const bar = buildRichProgressBar(rPct, 6);
    lines.push(`${icon} **${role.name}**: ${rPresent}/${rTotal} (${rPct}%) \`${bar}\``);
  }
  return lines;
}

function buildSessionEmbed(guild, session, attended = [], phaiRoleIds = [], _isEditing = false, page = 1, emojiMap = null) {
  const total   = attended.length;
  const joined  = attended.filter(a => a.status === 'tham_gia' || a.status === 'tre').length;
  const late    = attended.filter(a => a.status === 'tre').length;
  const absent  = attended.filter(a => a.status === 'khong_tham_gia').length;
  const excused = attended.filter(a => a.status === 'co_phep').length;
  const pct     = total > 0 ? Math.round(joined / total * 100) : 0;
  const bar     = buildRichProgressBar(pct);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const clampedPage = Math.max(1, Math.min(page, totalPages));
  const slice = attended.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const groups = _buildGroups(slice, guild, phaiRoleIds, emojiMap);
  const lines = _groupedList(groups);

  const startTs  = Math.floor(new Date(session.started_at ?? Date.now()).getTime() / 1000);
  const ch       = session.channel_id ? `<#${session.channel_id}>` : '_Chưa có kênh_';
  const startedBy = session.started_by ? `<@${session.started_by}>` : '';
  const eligibleCount = session.eligible_member_ids?.length ?? 0;

  const color = pct >= 80 ? COLORS.GREEN : pct >= 50 ? COLORS.YELLOW : COLORS.RED;

  const infoLines = [
    `▸ ${ch} · <t:${startTs}:R>${startedBy ? ` · bởi ${startedBy}` : ''}`,
  ];
  if (eligibleCount > 0) {
    infoLines.push(`▸ **${total}/${eligibleCount}** đã điểm danh`);
  }
  if (session.auto_close_at) {
    const msLeft = new Date(session.auto_close_at).getTime() - Date.now();
    if (msLeft > 0) {
      infoLines.push(`▸ ⏳ Đóng <t:${Math.floor(new Date(session.auto_close_at).getTime() / 1000)}:R>`);
    }
  }
  if (session.description) {
    infoLines.push(`▸ _${session.description}_`);
  }

  const desc = [
    `📅 **Thông tin phiên**`,
    ...infoLines,
    '',
    `${pctEmoji(pct)} **${pct}%** — ${pctLabel(pct)}`,
    `\`${bar}\``,
  ].join('\n');

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor(buildAuthor(guild))
    .setTitle(`📊 Điểm danh — ${session.session_name ?? 'Phiên'}`)
    .setDescription(desc)
    .setFooter({ text: `${FOOTER_DEFAULT} · Cập nhật lúc` })
    .setTimestamp();

  const firstPhaiId = phaiRoleIds?.[0];
  if (firstPhaiId) {
    const thumbUrl = buildPublicUrl(guild?.id, firstPhaiId);
    if (thumbUrl) embed.setThumbnail(thumbUrl);
  }

  const fields = [
    { name: `${ICONS.ATTEND_YES} Đúng giờ`, value: `**${joined - late}**`, inline: true },
    { name: `${ICONS.ATTEND_LATE} Trễ`,     value: `**${late}**`,         inline: true },
    { name: `${ICONS.ATTEND_NO} Vắng`,      value: `**${absent}**`,       inline: true },
    { name: `${ICONS.ATTEND_EXCUSE} Có phép`, value: `**${excused}**`,    inline: true },
    { name: '📊 Tổng', value: `**${total}**`, inline: true },
  ];
  if (eligibleCount > 0 && total > 0) {
    fields.push({ name: '🎯 Đạt', value: `**${pct}%**`, inline: true });
  }

  const safeEligible = session.eligible_member_ids ?? [];
  const eligibleSet = new Set(safeEligible.map ? safeEligible.map(m => m.id ?? m) : []);
  const phaiLines = _phaiStats(phaiRoleIds, guild, attended, eligibleSet, emojiMap);
  if (phaiLines.length) {
    fields.push({ name: '⚔️ Phái / Nhóm', value: phaiLines.join('\n'), inline: false });
  }

  const listTitle = total > 0
    ? `📋 Danh sách (${total}${totalPages > 1 ? ` · trang ${clampedPage}/${totalPages}` : ''})`
    : '📋 Danh sách';
  const listValue = lines.length ? lines.join('\n') : '_Chưa có ai điểm danh_';
  embed.addFields(...fields, { name: listTitle, value: listValue, inline: false });

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

function buildClosedSessionEmbed(session, attended = [], _guild, phaiRoleIds = [], emojiMap = null) {
  const total   = attended.length;
  const joined  = attended.filter(a => a.status === 'tham_gia' || a.status === 'tre').length;
  const late    = attended.filter(a => a.status === 'tre').length;
  const absent  = attended.filter(a => a.status === 'khong_tham_gia').length;
  const excused = attended.filter(a => a.status === 'co_phep').length;
  const pct     = total > 0 ? Math.round(joined / total * 100) : 0;
  const bar     = buildRichProgressBar(pct);
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

  // Phái stats
  const safeEligible = session?.eligible_member_ids ?? [];
  const eligibleSet = new Set(safeEligible.map ? safeEligible.map(m => m.id ?? m) : []);
  const phaiLines = _phaiStats(phaiRoleIds, _guild, attended, eligibleSet, emojiMap);

  // First 5 attendees
  const top = attended.slice(0, 5);
  const groups = _buildGroups(top, _guild, phaiRoleIds, emojiMap);
  const lines = _groupedList(groups);
  if (attended.length > 5) lines.push(`_... và ${attended.length - 5} người khác_`);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor(buildAuthor(_guild))
    .setTitle(`${ICONS.SESSION_CLOSED} Đã kết thúc — ${session?.session_name ?? 'Phiên'}`)
    .setDescription([
      ...infoLines,
      '',
      `${pctEmoji(pct)} **${pct}%** — ${pctLabel(pct)}`,
      `\`${bar}\``,
      `Tổng số: **${joined}/${total}**`,
    ].join('\n'))
    .addFields(
      { name: `${ICONS.ATTEND_YES} Đúng giờ`,  value: `**${joined - late}**`, inline: true },
      { name: `${ICONS.ATTEND_LATE} Trễ`,      value: `**${late}**`,         inline: true },
      { name: `${ICONS.ATTEND_NO} Vắng`,       value: `**${absent}**`,       inline: true },
      { name: `${ICONS.ATTEND_EXCUSE} Có phép`, value: `**${excused}**`,     inline: true },
    );

  if (phaiLines.length) {
    embed.addFields({ name: '⚔️ Phái / Nhóm', value: phaiLines.join('\n'), inline: false });
  }

  if (lines.length) {
    embed.addFields({ name: '📋 Thành viên', value: lines.join('\n'), inline: false });
  }

  embed
    .setFooter({ text: `${FOOTER_DEFAULT} · Đã đóng` })
    .setTimestamp();

  return embed;
}

module.exports = { buildSessionEmbed, buildClosedSessionEmbed };
