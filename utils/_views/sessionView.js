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
  buildPhaiStatsText, chunkLines,
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
function buildSessionEmbed(guild, session, attended = [], phaiRoleIds = [], isEditing = false, page = 1) {
  const total   = attended.length;
  const joined  = attended.filter(a => a.status === 'tham_gia' || a.status === 'tre').length;
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
      countdownLine = `\n⏳ Tự động đóng sau **${formatDuration(Math.floor(msLeft / 1000))}** — <t:${Math.floor(new Date(session.auto_close_at).getTime() / 1000)}:R>`;
    }
  }

  const descParts = [
    `${ICONS.SESSION_OPEN} **${session.session_name ?? 'Phiên điểm danh'}**`,
    `▸ Bắt đầu: <t:${startTs}:R>  ·  Kênh: ${ch}${countdownLine}`,
    '',
    `${pctEmoji(pct)} **Tỉ lệ: ${pct}%** — ${pctLabel(pct)}`,
    `\`${bar}\``,
  ];

  // Thống kê phái nếu có
  const phaiText = buildPhaiStatsText(guild, phaiRoleIds, attended, session.eligible_member_ids ?? []);
  if (phaiText) descParts.push('', phaiText);

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`${ICONS.CHART} Điểm danh${total > 0 ? ` — ${total} người` : ''}`)
    .setDescription(descParts.join('\n'))
    .addFields(
      { name: `${ICONS.ATTEND_YES} Tham gia`, value: `**${joined}**`, inline: true },
      { name: `${ICONS.ATTEND_NO} Vắng`,      value: `**${absent}**`, inline: true },
      { name: `${ICONS.ATTEND_EXCUSE} Có phép`, value: `**${excused}**`, inline: true },
      {
        name: `📋 Danh sách${totalPages > 1 ? ` (trang ${clampedPage}/${totalPages})` : ''}`,
        value: lines.length ? lines.join('\n') : '_Chưa có ai điểm danh_',
        inline: false,
      },
    )
    .setFooter({ text: `${FOOTER_DEFAULT} · Cập nhật lần cuối` })
    .setTimestamp();

  // Pagination buttons nếu nhiều hơn 1 trang
  const components = [];
  if (totalPages > 1) {
    const paginationRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`attend_view:prev:${clampedPage}`)
        .setLabel('◀ Trước')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(clampedPage <= 1),
      new ButtonBuilder()
        .setCustomId(`attend_view:next:${clampedPage}`)
        .setLabel('Sau ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(clampedPage >= totalPages),
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
  const total  = attended.length;
  const joined = attended.filter(a => a.status === 'tham_gia' || a.status === 'tre').length;
  const pct    = total > 0 ? Math.round(joined / total * 100) : 0;
  const bar    = buildRichProgressBar(pct);

  return new EmbedBuilder()
    .setColor(COLORS.NEUTRAL ?? 0x7a7974)
    .setTitle(`${ICONS.SESSION_CLOSED} Phiên đã kết thúc — ${session?.session_name ?? ''}`)
    .setDescription(
      [
        `${pctEmoji(pct)} **Tỉ lệ tham gia cuối: ${pct}%**`,
        `\`${bar}\``,
        '',
        `Tổng: **${joined}/${total}** người đã điểm danh`,
      ].join('\n')
    )
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();
}

module.exports = { buildSessionEmbed, buildClosedSessionEmbed };
