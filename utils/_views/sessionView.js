// utils/_views/sessionView.js
// [FIX] Implement đầy đủ buildSessionEmbed — signature đúng với callers:
//   buildSessionEmbed(guild, session, attended, phaiRoleIds, isEditing, page)
//   → { embed: EmbedBuilder, components: ActionRowBuilder[], totalPages: number }
//   buildClosedSessionEmbed(session, attended, guild) → EmbedBuilder
'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {
  COLORS, ICONS, FOOTER_DEFAULT,
  buildRichProgressBar, pctEmoji, pctLabel, formatDuration,
} = require('../_helpers');

const PAGE_SIZE = 15; // số người hiển thị mỗi trang

const STATUS_LABEL = {
  tham_gia:       `${ICONS.ATTEND_YES} Tham gia`,
  tre:            `${ICONS.ATTEND_LATE} Trễ`,
  khong_tham_gia: `${ICONS.ATTEND_NO} Vắng`,
  co_phep:        `${ICONS.ATTEND_EXCUSE} Có phép`,
};

/**
 * @param {import('discord.js').Guild} guild
 * @param {object} session
 * @param {Array}  attended    – rows từ attendanceService.getAttendances()
 * @param {string[]} phaiRoleIds
 * @param {boolean} isEditing  – true khi đang edit message cũ (không dùng, reserved)
 * @param {number}  page       – 1-indexed
 * @returns {{ embed: EmbedBuilder, components: ActionRowBuilder[], totalPages: number }}
 */
function buildSessionEmbed(guild, session, attended = [], phaiRoleIds = [], isEditing = false, page = 1, phaiRoleIcons = {}) {
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

  const lines = slice.map(a => {
    const name  = guild?.members?.cache?.get(a.user_id)?.displayName ?? `<@${a.user_id}>`;
    const label = STATUS_LABEL[a.status] ?? a.status;
    return `${label} — **${name}**`;
  });

  const startTs = Math.floor(new Date(session.started_at ?? Date.now()).getTime() / 1000);
  const ch = session.channel_id ? `<#${session.channel_id}>` : '_Chưa có kênh_';

  let countdownLine = '';
  if (session.auto_close_at) {
    const msLeft = new Date(session.auto_close_at).getTime() - Date.now();
    if (msLeft > 0) {
      countdownLine = `\n⏳ Đóng sau **${formatDuration(Math.floor(msLeft / 1000))}** — <t:${Math.floor(new Date(session.auto_close_at).getTime() / 1000)}:R>`;
    }
  }

  const color = pct >= 80 ? COLORS.GREEN : pct >= 50 ? COLORS.YELLOW : COLORS.RED;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`📊 Điểm danh — ${session.session_name ?? 'Phiên'}`)
    .setDescription([
      `${ICONS.SESSION_OPEN} **${session.session_name ?? 'Phiên'}**`,
      `▸ <t:${startTs}:R>  ·  ${ch}${countdownLine}`,
      '',
      `${pctEmoji(pct)} **${pct}%** — ${pctLabel(pct)}`,
      `\`${bar}\``,
    ].join('\n'))
    .setFooter({ text: `${FOOTER_DEFAULT} · Cập nhật lúc` })
    .setTimestamp();

  // Status inline fields
  const fields = [
    { name: `${ICONS.ATTEND_YES} Tham gia`, value: `**${joined - late}**`, inline: true },
    { name: `${ICONS.ATTEND_LATE} Trễ`,     value: `**${late}**`,         inline: true },
    { name: `${ICONS.ATTEND_NO} Vắng`,      value: `**${absent}**`,       inline: true },
    { name: `${ICONS.ATTEND_EXCUSE} Có phép`, value: `**${excused}**`,    inline: true },
  ];

  // Phái stats inline fields
  const icons = phaiRoleIcons ?? session.phai_role_icons ?? {};
  const safeEligible = session.eligible_member_ids ?? [];
  const eligibleSet = new Set(safeEligible.map ? safeEligible.map(m => m.id ?? m) : []);
  for (const roleId of (phaiRoleIds ?? [])) {
    const role = guild.roles?.cache?.get(roleId);
    if (!role) continue;
    const roleMembers = [...role.members.keys()].filter(id => eligibleSet.size === 0 || eligibleSet.has(id));
    const rTotal = roleMembers.length;
    const rPresent = attended.filter(a =>
      roleMembers.includes(a.user_id) && ['tham_gia', 'tre'].includes(a.status)
    ).length;
    const rPct = rTotal > 0 ? Math.round(rPresent / rTotal * 100) : 0;
    const icon = icons[roleId] ?? ICONS.SWORD;
    fields.push({ name: `${icon} ${role.name}`, value: `**${rPresent}/${rTotal}** (${rPct}%)`, inline: true });
  }

  embed.addFields(...fields, {
    name: `📋 Danh sách${totalPages > 1 ? ` (trang ${clampedPage}/${totalPages})` : ''}`,
    value: lines.length ? lines.join('\n') : '_Chưa có ai điểm danh_',
    inline: false,
  });

  // Pagination
  const components = [];
  if (totalPages > 1) {
    const paginationRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`attend_view:prev:${clampedPage}`).setLabel('◀ Trước').setStyle(ButtonStyle.Secondary).setDisabled(clampedPage <= 1),
      new ButtonBuilder().setCustomId(`attend_view:next:${clampedPage}`).setLabel('Sau ▶').setStyle(ButtonStyle.Secondary).setDisabled(clampedPage >= totalPages),
    );
    components.push(paginationRow);
  }

  return { embed, components, totalPages };
}

/**
 * Embed hiển thị sau khi phiên đã đóng (disable buttons)
 * @param {object} session
 * @param {Array}  attended
 * @param {import('discord.js').Guild} guild
 * @returns {EmbedBuilder}
 */
function buildClosedSessionEmbed(session, attended = [], guild) {
  const total   = attended.length;
  const joined  = attended.filter(a => a.status === 'tham_gia' || a.status === 'tre').length;
  const late    = attended.filter(a => a.status === 'tre').length;
  const absent  = attended.filter(a => a.status === 'khong_tham_gia').length;
  const excused = attended.filter(a => a.status === 'co_phep').length;
  const pct     = total > 0 ? Math.round(joined / total * 100) : 0;
  const bar     = buildRichProgressBar(pct);

  const color = pct >= 80 ? COLORS.GREEN : pct >= 50 ? COLORS.YELLOW : COLORS.RED;

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`${ICONS.SESSION_CLOSED} Đã kết thúc — ${session?.session_name ?? 'Phiên'}`)
    .setDescription([
      `${pctEmoji(pct)} **Kết quả: ${pct}%**`,
      `\`${bar}\``,
      `Tổng số: **${joined}/${total}**`,
    ].join('\n'))
    .addFields(
      { name: `${ICONS.ATTEND_YES} Tham gia`,  value: `**${joined - late}**`, inline: true },
      { name: `${ICONS.ATTEND_LATE} Trễ`,      value: `**${late}**`,         inline: true },
      { name: `${ICONS.ATTEND_NO} Vắng`,       value: `**${absent}**`,       inline: true },
      { name: `${ICONS.ATTEND_EXCUSE} Có phép`, value: `**${excused}**`,     inline: true },
    )
    .setFooter({ text: `${FOOTER_DEFAULT} · Đã đóng` })
    .setTimestamp();
}

module.exports = { buildSessionEmbed, buildClosedSessionEmbed };
