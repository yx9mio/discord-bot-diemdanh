// utils/_views/summaryView.js — buildSummaryEmbed (async)
'use strict';
const { EmbedBuilder } = require('discord.js');
const {
  COLORS, ICONS, FOOTER_DEFAULT,
  getEligibleIds, pctEmoji, buildRichProgressBar,
  formatDuration, resolveDisplayNameAsync, chunkLines, buildPhaiStatsText,
} = require('../_helpers');

async function buildSummaryEmbed(session, attended, guild = null, phaiRoleIds = null) {
  const joined   = attended.filter(a => a.status === 'tham_gia');
  const late     = attended.filter(a => a.status === 'tre');
  const declined = attended.filter(a => a.status === 'khong_tham_gia');
  const excused  = attended.filter(a => a.status === 'co_phep');

  // [#5-D3]
  const eligibleIds  = getEligibleIds(session);
  const eligible     = eligibleIds.length;
  const presentCount = joined.length + late.length;
  const pct          = eligible > 0 ? Math.round((presentCount / eligible) * 100) : 0;

  const startedAt = session.created_at ?? session.started_at;
  const startTs   = Math.floor(new Date(startedAt).getTime() / 1000);
  const endTs     = session.ended_at ? Math.floor(new Date(session.ended_at).getTime() / 1000) : null;
  const dur       = endTs ? formatDuration(endTs - startTs) : null;

  const badge  = pct >= 90 ? '🏆 Xuất sắc' : pct >= 80 ? '🥇 Tốt' : pct >= 60 ? '🥈 Khá' : pct >= 40 ? '🥉 TB' : '📉 Thấp';
  const richBar = buildRichProgressBar(pct);

  const descLines = [
    `## ${pctEmoji(pct)} ${pct}% — ${badge}`,
    `\`${richBar}\``,
    '',
    `> ${ICONS.ATTEND_YES} \`${joined.length} tham gia\`  ${ICONS.ATTEND_LATE} \`${late.length} trễ\`  ${ICONS.ATTEND_EXCUSE} \`${excused.length} có phép\`  ${ICONS.ATTEND_NO} \`${declined.length} vắng\`  ${ICONS.PERSON} \`${eligible} thành viên\``,
    '',
    `${ICONS.CLOCK} <t:${startTs}:f>${endTs ? `  →  <t:${endTs}:f>` : ''}${dur ? `  ·  ⏱ **${dur}**` : ''}`,
  ];

  const embed = new EmbedBuilder()
    .setColor(pct >= 80 ? COLORS.GREEN : pct >= 60 ? COLORS.YELLOW : COLORS.RED)
    .setTitle(`📊 Kết quả: ${session.session_name}`)
    .setDescription(descLines.join('\n'))
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  if (typeof guild?.iconURL === 'function') {
    const url = guild.iconURL({ dynamic: true, size: 64 });
    if (url) embed.setThumbnail(url);
  }

  const earliest = [...joined, ...late]
    .filter(a => a.checked_in_at)
    .sort((a, b) => new Date(a.checked_in_at) - new Date(b.checked_in_at))
    .slice(0, 3);
  if (earliest.length > 0) {
    const medals = ['🥇', '🥈', '🥉'];
    embed.addFields({
      name: '⚡ Điểm danh sớm nhất',
      value: earliest.map((a, i) => `${medals[i]} <@${a.user_id}> · <t:${Math.floor(new Date(a.checked_in_at).getTime() / 1000)}:t>`).join('\n'),
      inline: false,
    });
  }

  // [#5-D1] resolveDisplayNameAsync
  const MAX = 25;

  if (joined.length > 0) {
    const names = await Promise.all(
      joined.slice(0, MAX).map((a, i) =>
        resolveDisplayNameAsync(guild, a.user_id, `<@${a.user_id}>`)
          .then(name => `\`${String(i + 1).padStart(2)}.\` ${name}`)
      )
    );
    const extra = joined.length > MAX ? `\n*(+${joined.length - MAX} nữa)*` : '';
    chunkLines(names).slice(0, 1).forEach(chunk =>
      embed.addFields({ name: `${ICONS.ATTEND_YES} Tham Gia (${joined.length})`, value: chunk + extra, inline: true })
    );
  }

  if (late.length > 0) {
    const names = await Promise.all(
      late.slice(0, MAX).map((a, i) =>
        resolveDisplayNameAsync(guild, a.user_id, `<@${a.user_id}>`)
          .then(name => `\`${String(i + 1).padStart(2)}.\` ${name}`)
      )
    );
    const extra = late.length > MAX ? `\n*(+${late.length - MAX} nữa)*` : '';
    chunkLines(names).slice(0, 1).forEach(chunk =>
      embed.addFields({ name: `${ICONS.ATTEND_LATE} Đến Trễ (${late.length})`, value: chunk + extra, inline: true })
    );
  }

  // [#5-D3]
  const absentIds = eligibleIds.filter(id => !new Set(attended.map(a => a.user_id)).has(id));
  if (absentIds.length > 0) {
    const MAX2 = 25;
    const names2 = await Promise.all(
      absentIds.slice(0, MAX2).map((id, i) =>
        resolveDisplayNameAsync(guild, id, `<@${id}>`)
          .then(name => `\`${String(i + 1).padStart(2)}.\` ${name}`)
      )
    );
    const extra2 = absentIds.length > MAX2 ? `\n*(+${absentIds.length - MAX2} nữa)*` : '';
    chunkLines(names2).slice(0, 1).forEach(chunk =>
      embed.addFields({ name: `${ICONS.ATTEND_ABSENT} Vắng Mặt (${absentIds.length})`, value: chunk + extra2, inline: false })
    );
  }

  if (excused.length > 0) {
    embed.addFields({
      name: `${ICONS.ATTEND_EXCUSE} Có Phép (${excused.length})`,
      value: excused.slice(0, 10).map(a => `<@${a.user_id}>`).join(' '),
      inline: false,
    });
  }

  const phaiText = buildPhaiStatsText(guild, phaiRoleIds, attended, eligibleIds.map(id => ({ id })));
  if (phaiText)
    embed.addFields({ name: `${ICONS.SWORD} Thống Kê Phái`, value: phaiText, inline: false });

  return embed;
}

module.exports = { buildSummaryEmbed };
