'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, ICONS, getPhaiIcon } = require('../../../../utils/theme.js');
const { FOOTER_DEFAULT, buildAuthor } = require('../../../../utils/embeds.js');
const { fmtTs } = require('../../../../utils/format.js');

const CUSTOM_ID = {
  SUMMARY:     'setup:session',
  ROSTER:      'setup:session:roster',
  DETAILS:     'setup:session:details',
  BACK:        'setup:session:back',
  REFRESH:     'setup:session:refresh',
  ROSTER_PREV: 'setup:session:roster:prev',
  ROSTER_NEXT: 'setup:session:roster:next',
  START:       'setup:session:start',
};

const ROSTER_PAGE_SIZE = 10;

function _bar(value, max, len) {
  if (!max || max <= 0) return '░'.repeat(len);
  const filled = Math.round(Math.min(value / max, 1) * len);
  return '█'.repeat(filled) + '░'.repeat(len - filled);
}

function _fmtFooter(ctx, sessionId, page) {
  let s = `⚔️ · ${ctx}`;
  if (sessionId != null) s += ` · sid:${sessionId}`;
  if (page != null) s += ` · p:${page}`;
  return { text: `${s} · ${FOOTER_DEFAULT}` };
}

function parseFooter(footer) {
  const res = { ctx: 'summary', sessionId: null, page: 0 };
  if (!footer?.text) return res;
  for (const part of footer.text.split(' · ')) {
    if (part === 'roster') res.ctx = 'roster';
    else if (part === 'details') res.ctx = 'details';
    else if (part.startsWith('sid:')) res.sessionId = part.slice(4);
    else if (part.startsWith('p:')) res.page = parseInt(part.slice(2), 10) || 0;
  }
  return res;
}

function _computePhai(session, guild, members, attendances, cfg) {
  const phaiIds = cfg?.phai_role_ids ?? [];
  if (!phaiIds.length) return [];
  const attMap = {};
  for (const a of attendances) attMap[a.user_id] = a.status;

  return phaiIds.map(roleId => {
    const membersIn = members.filter(m => (m.phai_role_ids ?? []).includes(roleId));
    const total = membersIn.length;
    if (!total) return null;
    const attended = membersIn.filter(m =>
      attMap[m.user_id] && ['tham_gia', 'tre'].includes(attMap[m.user_id])
    ).length;
    const role = guild?.roles?.cache?.get(roleId);
    const icon = getPhaiIcon(roleId, phaiIds, guild, cfg?.phai_role_icons);
    return { icon, name: role?.name ?? `<@&${roleId}>`, attended, total };
  }).filter(Boolean);
}

function _resolveName(guild, userId, fallback) {
  const m = guild?.members?.cache?.get(userId);
  return m ? (m.displayName || m.user.username) : (fallback ?? userId);
}

function renderSummary({ session, guild, cfg, members, attendances }) {
  const active = !!session;
  const eligible = session?.eligible_member_ids?.length ?? 0;
  const attended = attendances.filter(a => a.status === 'tham_gia').length;
  const late = attendances.filter(a => a.status === 'tre').length;
  const absent = attendances.filter(a => a.status === 'khong_tham_gia').length;
  const excused = attendances.filter(a => a.status === 'co_phep').length;
  const totalPresent = attended + late;
  const pct = eligible > 0 ? Math.round((totalPresent / eligible) * 100) : 0;

  const embed = new EmbedBuilder()
    .setColor(active ? COLORS.PRIMARY : COLORS.NEUTRAL)
    .setAuthor(buildAuthor(guild));

  if (active) {
    const name = session.session_name ?? 'Bang Chiến';
    const shortDay = session.started_at ? fmtTs(session.started_at).split(' ')[0] : '';
    embed.setTitle(`⚔️ Bang Chiến ${name}`);

    const bar = _bar(totalPresent, eligible || 1, 14);
    const emoji = pct >= 90 ? '🏆' : pct >= 75 ? '🥇' : pct >= 50 ? '🥈' : '📉';

    let desc = `${emoji} **${pct}%** tham gia\n${bar}\n\n`;
    desc += `👥 **Quân số**\n`;
    desc += `${ICONS.ATTEND_YES} ${attended}　${ICONS.ATTEND_LATE} ${late}\n`;
    desc += `${ICONS.ATTEND_NO} ${absent}　${ICONS.ATTEND_EXCUSE} ${excused}`;

    const phai = _computePhai(session, guild, members, attendances, cfg);
    if (phai.length) {
      const lines = phai.map(p => `${p.icon} ${p.name}  ${p.attended}/${p.total}`);
      desc += `\n\n⚔️ **Theo phái**\n${lines.join('\n')}`;
    }

    embed.setDescription(desc);
    embed.setFooter(_fmtFooter('summary', session.id));
  } else {
    embed.setTitle('⚔️ Bang Chiến')
      .setDescription('_Chưa có Kỳ Bang Chiến nào đang mở._\nNhấn **➕ Mở Kỳ mới** để bắt đầu điểm danh.')
      .setFooter({ text: FOOTER_DEFAULT });
    if (members?.length > 0) {
      embed.addFields({ name: '👥 Quân số', value: `${members.length} người`, inline: true });
    }
  }

  const components = [];

  if (active) {
    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(CUSTOM_ID.ROSTER).setLabel('👥 Danh sách').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(CUSTOM_ID.DETAILS).setLabel('📊 Chi tiết').setStyle(ButtonStyle.Secondary),
      ),
    );
  }

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.REFRESH).setLabel('Làm mới').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.START).setLabel('➕ Mở Kỳ mới').setStyle(ButtonStyle.Success),
  );
  if (active) {
    actionRow.addComponents(
      new ButtonBuilder().setCustomId(`${'setup:session:close:'}${session.id}`).setLabel('✖ Đóng Kỳ').setStyle(ButtonStyle.Danger),
    );
  }
  components.push(actionRow);

  components.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('setup:home').setLabel('← Dashboard').setStyle(ButtonStyle.Secondary),
    ),
  );

  return { embeds: [embed], components };
}

function renderRoster({ session, guild, attendances, page }) {
  const rows = [];
  const byStatus = { tham_gia: [], tre: [], khong_tham_gia: [], co_phep: [] };
  for (const a of attendances) {
    if (byStatus[a.status]) byStatus[a.status].push(a);
  }

  const flat = [];
  const groups = [
    { id: 'tham_gia', label: `${ICONS.ATTEND_YES} Đúng giờ` },
    { id: 'tre', label: `${ICONS.ATTEND_LATE} Trễ` },
    { id: 'khong_tham_gia', label: `${ICONS.ATTEND_NO} Vắng` },
    { id: 'co_phep', label: `${ICONS.ATTEND_EXCUSE} Có phép` },
  ];
  for (const g of groups) {
    if (byStatus[g.id].length) {
      flat.push(`__${g.label}__`);
      for (const a of byStatus[g.id]) {
        flat.push(`‣ ${_resolveName(guild, a.user_id, a.username)}`);
      }
    }
  }

  const totalPages = Math.max(1, Math.ceil(flat.length / ROSTER_PAGE_SIZE));
  const cPage = Math.max(0, Math.min(page ?? 0, totalPages - 1));
  const start = cPage * ROSTER_PAGE_SIZE;
  const slice = flat.slice(start, start + ROSTER_PAGE_SIZE);

  const name = session?.session_name ?? 'Bang Chiến';
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setAuthor(buildAuthor(guild))
    .setTitle(`👥 Danh sách — ${name}`)
    .setDescription(slice.length ? slice.join('\n') : '_Trống_')
    .setFooter(_fmtFooter('roster', session?.id, cPage));

  const components = [];
  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.BACK).setLabel('← ⚔️ Bang Chiến').setStyle(ButtonStyle.Secondary),
  );
  if (totalPages > 1) {
    navRow.addComponents(
      new ButtonBuilder().setCustomId(CUSTOM_ID.ROSTER_PREV).setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(cPage <= 0),
      new ButtonBuilder().setCustomId(CUSTOM_ID.ROSTER_NEXT).setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(cPage >= totalPages - 1),
    );
  }
  components.push(navRow);

  components.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(CUSTOM_ID.REFRESH).setLabel('Làm mới').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('setup:home').setLabel('← Dashboard').setStyle(ButtonStyle.Secondary),
    ),
  );

  return { embeds: [embed], components };
}

function renderDetails({ session, guild, members, attendances, cfg }) {
  const eligible = session?.eligible_member_ids?.length ?? 0;
  const attended = attendances.filter(a => a.status === 'tham_gia').length;
  const late = attendances.filter(a => a.status === 'tre').length;
  const absent = attendances.filter(a => a.status === 'khong_tham_gia').length;
  const excused = attendances.filter(a => a.status === 'co_phep').length;
  const totalPresent = attended + late;
  const pct = eligible > 0 ? Math.round((totalPresent / eligible) * 100) : 0;

  const phai = _computePhai(session, guild, members, attendances, cfg);
  let most = null, least = null;
  if (phai.length) {
    phai.sort((a, b) => b.attended - a.attended);
    most = phai[0];
    least = phai[phai.length - 1];
  }

  const name = session?.session_name ?? 'Bang Chiến';
  const emoji = pct >= 90 ? '🏆' : pct >= 75 ? '🥇' : pct >= 50 ? '🥈' : '📉';

  let desc = `${emoji} **Tỷ lệ:** ${pct}% (${totalPresent}/${eligible})\n`;
  desc += `👥 **Tổng:** ${eligible} người\n`;
  desc += `${ICONS.ATTEND_YES} Đúng giờ: ${attended}\n`;
  desc += `${ICONS.ATTEND_LATE} Trễ: ${late}\n`;
  desc += `${ICONS.ATTEND_NO} Vắng: ${absent}\n`;
  desc += `${ICONS.ATTEND_EXCUSE} Có phép: ${excused}\n`;
  if (most) desc += `\n🔥 **Phái đông nhất:** ${most.icon} ${most.name} (${most.attended}/${most.total})`;
  if (least && least !== most) desc += `\n📉 **Phái ít nhất:** ${least.icon} ${least.name} (${least.attended}/${least.total})`;

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setAuthor(buildAuthor(guild))
    .setTitle(`📊 Chi tiết — ${name}`)
    .setDescription(desc)
    .setFooter(_fmtFooter('details', session?.id));

  const components = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(CUSTOM_ID.BACK).setLabel('← ⚔️ Bang Chiến').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(CUSTOM_ID.REFRESH).setLabel('Làm mới').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('setup:home').setLabel('← Dashboard').setStyle(ButtonStyle.Secondary),
    ),
  ];

  return { embeds: [embed], components };
}

module.exports = { SessionView: { renderSummary, renderRoster, renderDetails, CUSTOM_ID, parseFooter } };
