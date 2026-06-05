// utils/_views/sessionView.js — buildSessionEmbed, buildClosedSessionEmbed
'use strict';
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const {
  COLORS, ICONS, FOOTER_DEFAULT,
  getEligibleIds, buildRichProgressBar, buildPhaiStatsText,
} = require('../_helpers');

// ─── Session Embed (live + closed) ───────────────────────────────────────────
// [C] Return thêm totalPages để caller có thể clamp page khi navigate
function buildSessionEmbed(guild, session, attended, phaiRoleIds = [], isClosed = false, page = 1) {
  const PAGE_SIZE = 20;
  const joined   = attended.filter(a => a.status === 'tham_gia');
  const late     = attended.filter(a => a.status === 'tre');
  const declined = attended.filter(a => a.status === 'khong_tham_gia');
  const excused  = attended.filter(a => a.status === 'co_phep');

  // [#5-D3]
  const eligibleIds  = getEligibleIds(session);
  const eligible     = eligibleIds.length;
  const presentCount = joined.length + late.length;
  const pct = eligible > 0 ? Math.round(presentCount / eligible * 100) : 0;

  const checkedIds = new Set(attended.map(a => a.user_id));
  const absentIds  = eligibleIds.filter(id => !checkedIds.has(id));

  const roleDisplay = session.allowed_role_id
    ? `<@&${session.allowed_role_id}>`
    : (session.role_name ?? 'Tất cả');

  let deadlineLine = '';
  if (!isClosed && session.ends_at) {
    const endsTs  = Math.floor(new Date(session.ends_at).getTime() / 1000);
    const nowSec  = Math.floor(Date.now() / 1000);
    const diffMin = Math.round((endsTs - nowSec) / 60);
    deadlineLine = diffMin > 0
      ? `\n⏱ Kết thúc <t:${endsTs}:R> · còn **${diffMin} phút**`
      : `\n⏱ Đã quá hạn`;
  }

  const statusLine = `${ICONS.SESSION_OPEN} **Đang mở** · ${roleDisplay} · ${eligible} thành viên${deadlineLine}`;

  // [#5-D2] Pagination nhất quán — totalPages tính theo list DÀI nhất
  const absMentions    = absentIds.map(id => `<@${id}>`);
  const declMentions   = declined.map(a => `<@${a.user_id}>`);
  const joinedMentions = joined.map(a => `<@${a.user_id}>`);
  const lateMentions   = late.map(a => `<@${a.user_id}>`);
  const absentAll      = [...declMentions, ...absMentions];

  const totalItems = Math.max(joinedMentions.length, lateMentions.length, absentAll.length);
  const totalPages = totalItems > 0 ? Math.ceil(totalItems / PAGE_SIZE) : 1;
  const clampedPage = Math.min(Math.max(page, 1), totalPages);
  const start = (clampedPage - 1) * PAGE_SIZE;

  function fieldValue(items, emptyMsg) {
    if (!items.length) return emptyMsg;
    const slice = items.slice(start, start + PAGE_SIZE);
    if (!slice.length) return `*(hết)*`;
    let val = slice.join(' ');
    if (totalPages > 1) val += `\n*(trang ${clampedPage}/${totalPages})*`;
    return val;
  }

  const embed = new EmbedBuilder()
    .setColor(isClosed ? COLORS.RED : COLORS.GREEN)
    .setTitle(`${isClosed ? ICONS.SESSION_CLOSED : ICONS.SESSION_OPEN} ${session.session_name}`)
    .setDescription(isClosed ? `${ICONS.SESSION_CLOSED} **Phiên đã kết thúc**` : statusLine)
    .addFields(
      { name: `${ICONS.ATTEND_YES} Tham gia (${joined.length})`,  value: fieldValue(joinedMentions, '*Chưa có*'), inline: true },
      { name: `${ICONS.ATTEND_LATE} Đến trễ (${late.length})`,    value: fieldValue(lateMentions,   '*Chưa có*'), inline: true },
      { name: `${ICONS.ATTEND_NO} Vắng (${declined.length + absentIds.length})`, value: fieldValue(absentAll, '*Không có*'), inline: true },
    )
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  if (typeof guild?.iconURL === 'function') {
    const url = guild.iconURL({ dynamic: true, size: 64 });
    if (url) embed.setThumbnail(url);
  }

  if (!isClosed && eligible > 0) {
    embed.addFields({ name: `${ICONS.CHART} Tiến độ`, value: `${buildRichProgressBar(pct)} **${pct}%**`, inline: false });
  }

  if (excused.length > 0) {
    embed.addFields({ name: `${ICONS.ATTEND_EXCUSE} Có phép (${excused.length})`, value: excused.slice(0, 10).map(a => `<@${a.user_id}>`).join(' '), inline: false });
  }

  const phaiText = buildPhaiStatsText(guild, phaiRoleIds, attended, eligibleIds.map(id => ({ id })));
  if (phaiText) {
    embed.addFields({ name: `${ICONS.SWORD} 🎭 Thống kê phái`, value: phaiText, inline: false });
  }

  const components = [];
  if (totalPages > 1) {
    const paginationRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`attend_view:prev:${clampedPage}`)
        .setLabel('◀ Trước')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(clampedPage === 1),
      new ButtonBuilder()
        .setCustomId(`attend_view:next:${clampedPage}`)
        .setLabel('Tiếp ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(clampedPage === totalPages),
    );
    components.push(paginationRow);
  }

  // [C] Expose totalPages cho caller để clamp khi navigate
  return { embed, components, totalPages };
}

/**
 * buildClosedSessionEmbed — trả về { embed, components } nhất quán.
 * [#4/#7] Fix: destructure rõ ràng.
 */
function buildClosedSessionEmbed(session, attended, guild = null) {
  const { embed } = buildSessionEmbed(guild, session, attended ?? [], [], true);
  return { embed, components: [] };
}

module.exports = { buildSessionEmbed, buildClosedSessionEmbed };
