// utils/_views/summaryView.js
// [FIX] Implement buildSummaryEmbed(session, attended, guild, phai_role_ids)
// Trả về raw EmbedBuilder (không wrap {embeds}) vì callers tự wrap:
//   ch.send({ embeds: [summaryEmbed] })
'use strict';
const { EmbedBuilder } = require('discord.js');
const { COLORS, ICONS, FOOTER_DEFAULT, buildRichProgressBar, pctEmoji, pctLabel } = require('../_helpers');
const { getPhaiIcon } = require('../theme.js');

const STATUS_LABEL = {
  tham_gia:       `${ICONS.ATTEND_YES} Tham gia`,
  tre:            `${ICONS.ATTEND_LATE} Trễ`,
  khong_tham_gia: `${ICONS.ATTEND_NO} Vắng`,
  co_phep:        `${ICONS.ATTEND_EXCUSE} Có phép`,
};

/**
 * @param {object} session
 * @param {Array}  attended   - rows từ attendanceService.getAttendances()
 * @param {import('discord.js').Guild} guild
 * @param {string[]} phai_role_ids
 * @returns {EmbedBuilder}
 */
function buildSummaryEmbed(session, attended = [], guild, phai_role_ids = []) {
  const total   = attended.length;
  const joined  = attended.filter(a => a.status === 'tham_gia' || a.status === 'tre').length;
  const absent  = attended.filter(a => a.status === 'khong_tham_gia').length;
  const excused = attended.filter(a => a.status === 'co_phep').length;
  const late    = attended.filter(a => a.status === 'tre').length;
  const pct     = total > 0 ? Math.round(joined / total * 100) : 0;
  const bar     = buildRichProgressBar(pct);

  const lines = attended.slice(0, 20).map(a => {
    const name  = guild?.members?.cache?.get(a.user_id)?.displayName ?? `<@${a.user_id}>`;
    const label = STATUS_LABEL[a.status] ?? a.status;
    return `${label} — **${name}**`;
  });
  if (attended.length > 20) lines.push(`_... và ${attended.length - 20} người khác_`);

  const color = pct >= 80 ? COLORS.GREEN : pct >= 50 ? COLORS.YELLOW : COLORS.RED;

  // Phái stats
  const phaiLines = [];
  const eligibleSet = new Set((session.eligible_member_ids ?? []).map(m => m.id ?? m));
  for (const roleId of (phai_role_ids ?? [])) {
    const role = guild?.roles?.cache?.get(roleId);
    if (!role) continue;
    const roleMembers = [...role.members.keys()].filter(id => eligibleSet.size === 0 || eligibleSet.has(id));
    const rTotal = roleMembers.length;
    const rPresent = attended.filter(a =>
      roleMembers.includes(a.user_id) && ['tham_gia', 'tre'].includes(a.status)
    ).length;
    const rPct = rTotal > 0 ? Math.round(rPresent / rTotal * 100) : 0;
    const icon = getPhaiIcon(roleId, phai_role_ids, guild);
    phaiLines.push(`${icon} **${role.name}**: ${rPresent}/${rTotal} (${rPct}%)`);
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`📊 Tổng kết — ${session?.session_name ?? 'Phiên điểm danh'}`)
    .setDescription([
      `${pctEmoji(pct)} **Tỉ lệ tham gia: ${pct}%** — ${pctLabel(pct)}`,
      `\`${bar}\``,
    ].join('\n'))
    .addFields(
      { name: `${ICONS.ATTEND_YES} Tham gia`, value: `**${joined}**`,  inline: true },
      { name: `${ICONS.ATTEND_NO} Vắng`,      value: `**${absent}**`,  inline: true },
      { name: `${ICONS.ATTEND_EXCUSE} Có phép`, value: `**${excused}**`, inline: true },
      ...(late > 0 ? [{ name: `${ICONS.ATTEND_LATE} Trễ`, value: `**${late}**`, inline: true }] : []),
    );
  if (phaiLines.length) {
    embed.addFields({ name: '⚔️ Phái / Nhóm', value: phaiLines.join('\n'), inline: false });
  }
  embed.addFields(
    { name: '📋 Chi tiết', value: lines.length ? lines.join('\n') : '_Không có ai_', inline: false },
  )
    .setFooter({ text: `${FOOTER_DEFAULT} · Tổng ${total} người` })
    .setTimestamp();
  return embed;
}

module.exports = { buildSummaryEmbed };
