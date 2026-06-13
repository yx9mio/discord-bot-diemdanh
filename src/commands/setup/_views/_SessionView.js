'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, ICONS, getPhaiIcon }  = require('../../../../utils/theme.js');
const { FOOTER_DEFAULT } = require('../../../../utils/embeds.js');
const { fmtTs }          = require('../../../../utils/format.js');

const CUSTOM_ID = {
  SESSION_START:     'setup:session:start',
  SESSION_CLOSE:     'setup:session:close:',
  SESSION_CLOSE_ALL: 'setup:session:close:all',
  SESSION_EXPORT:    'setup:session:export:',
  SESSION_DETAIL:    'setup:session:detail:',
  SESSION_REFRESH:   'setup:session:refresh',
  BACK_HOME:         'setup:home',
};

const PAGE_SIZE = 5;

function _progressBar(value, max) {
  if (!max || max <= 0) return '░'.repeat(10);
  const filled = Math.round((value / max) * 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function _sessionCard(session, idx) {
  const totalEligible = session.eligible_count ?? 0;
  const totalIn       = session.attended_count ?? 0;
  const totalLate     = session.late_count     ?? 0;
  const totalAbsent   = session.absent_count   ?? 0;
  const pct = totalEligible > 0 ? Math.round((totalIn / totalEligible) * 100) : 0;
  const bar = _progressBar(totalIn, totalEligible || 1);

  return [
    `**#${idx} — ${session.session_name ?? 'Phiên điểm danh'}**`,
    session.description ? `_${session.description}_` : null,
    `${bar} **${pct}%** điểm danh (${totalIn}/${totalEligible})`,
    `▸ Bắt đầu: ${fmtTs(session.started_at)}`,
    session.auto_close_at ? `▸ Tự đóng: ${fmtTs(session.auto_close_at)}` : null,
    totalLate > 0 || totalAbsent > 0 ? `▸ ⏰ Trễ ${totalLate} · ❌ Vắng ${totalAbsent}` : null,
  ].filter(Boolean).join('\n');
}

function _sessionCardExpanded(session, idx, cfg = null, guild = null) {
  const card = _sessionCard(session, idx);
  const phaiIds = cfg?.phai_role_ids ?? [];
  const extra = [
    `▸ ID: \`${session.id}\``,
    `▸ Tạo bởi: <@${session.created_by}>`,
    session.phai_role_ids?.length ? `▸ Phái:\n${session.phai_role_ids.map(r => `${getPhaiIcon(r, phaiIds, guild, cfg?.phai_role_icons)} <@&${r}>`).join('\n')}` : null,
    session.eligible_member_ids?.length ? `▸ Thành viên: ${session.eligible_member_ids.length} người` : null,
    session.created_at ? `▸ Tạo lúc: ${fmtTs(session.created_at)}` : null,
  ].filter(Boolean).join('\n');
  return card + '\n' + extra;
}

function render({ sessions, page = 0, guild, cfg, members = [], detailId = null }) {
  const all   = Array.isArray(sessions) ? sessions.filter(s => s.is_active) : [];
  const total = all.length;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cPage      = Math.max(0, Math.min(page, totalPages - 1));
  const start      = cPage * PAGE_SIZE;
  const slice      = all.slice(start, start + PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setColor(total > 0 ? COLORS.SUCCESS : COLORS.PRIMARY)
    .setTitle(`${total > 0 ? ICONS.SESSION : '⚪'} Quản lý phiên — ${guild.name}`)
    .setFooter({ text: `${FOOTER_DEFAULT} · Trang ${cPage + 1}/${totalPages} · Tổng ${total} phiên` })
    .setTimestamp();

  if (total === 0) {
    embed.setDescription('_Không có phiên nào đang mở._\nNhấn **Mở phiên mới** để bắt đầu điểm danh.');
    if (members.length > 0) {
      embed.addFields({ name: '👥 Thành viên', value: `${members.length} người`, inline: true });
    }
  } else {
    const desc = slice.map((s, i) => {
      const idx = start + i + 1;
      return s.id === detailId
        ? _sessionCardExpanded(s, idx, cfg, guild)
        : _sessionCard(s, idx);
    }).join('\n\n');
    embed.setDescription(desc);
  }

  const components = [];

  if (total > 0) {
    const closeRow = new ActionRowBuilder();
    const detailRow = new ActionRowBuilder();
    for (const s of slice) {
      const idx = start + slice.indexOf(s) + 1;
      const isExpanded = s.id === detailId;
      closeRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID.SESSION_CLOSE}${s.id}`)
          .setLabel(`✖ #${idx}`)
          .setStyle(ButtonStyle.Danger),
      );
      detailRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID.SESSION_DETAIL}${s.id}`)
          .setLabel(isExpanded ? `▴ #${idx}` : `▾ #${idx}`)
          .setStyle(ButtonStyle.Secondary),
      );
    }
    components.push(detailRow, closeRow);
  }

  const ctrlRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.SESSION_START).setLabel('Mở phiên mới').setEmoji(ICONS.PLUS).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(CUSTOM_ID.SESSION_REFRESH).setLabel('Làm mới').setEmoji(ICONS.REFRESH).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.BACK_HOME).setLabel('← Dashboard').setEmoji(ICONS.HOME).setStyle(ButtonStyle.Secondary),
  );

  if (total > 1) {
    ctrlRow.addComponents(
      new ButtonBuilder().setCustomId(CUSTOM_ID.SESSION_CLOSE_ALL).setLabel(`✖ Đóng tất cả (${total})`).setEmoji(ICONS.CLOSE).setStyle(ButtonStyle.Danger),
    );
  }

  components.push(ctrlRow);

  return { embeds: [embed], components, _page: cPage, _totalPages: totalPages, _detailId: detailId };
}

module.exports = { SessionView: { render, CUSTOM_ID } };
