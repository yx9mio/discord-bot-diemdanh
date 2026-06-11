// utils/_views/sessionView.js
// Option B "Dashboard": clean layout, bởi @user, progress bar + % 1 dòng, phái stats
'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {
  COLORS, ICONS, FOOTER_DEFAULT,
  buildRichProgressBar, pctEmoji, pctLabel, formatDuration,
} = require('../_helpers');

const PAGE_SIZE = 15;

const STATUS_LABEL = {
  tham_gia:       `${ICONS.ATTEND_YES} Tham gia`,
  tre:            `${ICONS.ATTEND_LATE} Trễ`,
  khong_tham_gia: `${ICONS.ATTEND_NO} Vắng`,
  co_phep:        `${ICONS.ATTEND_EXCUSE} Có phép`,
};

function buildSessionEmbed(guild, session, attended = [], phaiRoleIds = [], _isEditing = false, page = 1, phaiRoleIcons = {}) {
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

  const startTs  = Math.floor(new Date(session.started_at ?? Date.now()).getTime() / 1000);
  const ch       = session.channel_id ? `<#${session.channel_id}>` : '_Chưa có kênh_';
  const startedBy = session.started_by ? `<@${session.started_by}>` : '';

  let countdownLine = '';
  if (session.auto_close_at) {
    const msLeft = new Date(session.auto_close_at).getTime() - Date.now();
    if (msLeft > 0) {
      countdownLine = `\n⏳ Còn **${formatDuration(Math.floor(msLeft / 1000))}** — <t:${Math.floor(new Date(session.auto_close_at).getTime() / 1000)}:R>`;
    }
  }

  const color = pct >= 80 ? COLORS.GREEN : pct >= 50 ? COLORS.YELLOW : COLORS.RED;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`📊 Điểm danh — ${session.session_name ?? 'Phiên'}`)
    .setDescription([
      `${ICONS.SESSION_OPEN} **${session.session_name ?? 'Phiên'}**`,
      `▸ ${ch} · <t:${startTs}:R>${startedBy ? ` · bởi ${startedBy}` : ''}${countdownLine}`,
      '',
      `${pctEmoji(pct)} **${pct}%** — ${pctLabel(pct)}   \`${bar}\``,
    ].join('\n'))
    .setFooter({ text: `${FOOTER_DEFAULT} · Cập nhật lúc` })
    .setTimestamp();

  const fields = [
    { name: `${ICONS.ATTEND_YES} Tham gia`, value: `**${joined - late}**`, inline: true },
    { name: `${ICONS.ATTEND_LATE} Trễ`,     value: `**${late}**`,         inline: true },
    { name: `${ICONS.ATTEND_NO} Vắng`,      value: `**${absent}**`,       inline: true },
    { name: `${ICONS.ATTEND_EXCUSE} Có phép`, value: `**${excused}**`,    inline: true },
  ];

  // Phái stats
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

function buildClosedSessionEmbed(session, attended = [], _guild) {
  const total   = attended.length;
  const joined  = attended.filter(a => a.status === 'tham_gia' || a.status === 'tre').length;
  const late    = attended.filter(a => a.status === 'tre').length;
  const absent  = attended.filter(a => a.status === 'khong_tham_gia').length;
  const excused = attended.filter(a => a.status === 'co_phep').length;
  const pct     = total > 0 ? Math.round(joined / total * 100) : 0;
  const bar     = buildRichProgressBar(pct);
  const color   = pct >= 80 ? COLORS.GREEN : pct >= 50 ? COLORS.YELLOW : COLORS.RED;

  const startedBy = session?.started_by ? `<@${session.started_by}>` : '';

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`${ICONS.SESSION_CLOSED} Đã kết thúc — ${session?.session_name ?? 'Phiên'}`)
    .setDescription([
      `${pctEmoji(pct)} **${pct}%** — ${pctLabel(pct)}   \`${bar}\``,
      `Tổng số: **${joined}/${total}**${startedBy ? ` · bởi ${startedBy}` : ''}`,
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
