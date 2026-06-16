'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, ICONS, getPhaiIcon } = require('../../../../utils/theme.js');
const { FOOTER_DEFAULT, buildAuthor } = require('../../../../utils/embeds.js');
const { DAY_NAMES: DAY_VI } = require('../../../../utils/format.js');

const CUSTOM_ID = {
  HOME:      'setup:home',
  CFG:       'setup:cfg',
  SCH:       'setup:sch',
  MEM:       'setup:mem',
  SESSION:   'setup:session',
  START:     'setup:session:start',
  REFRESH:   'setup:home:refresh',
  HISTORY:   'setup:history',
  BROADCAST: 'setup:session:broadcast',
  STATS:     'setup:stats',
  AUDIT:     'setup:audit',
};

function _fmtSchedule(s) {
  const day  = DAY_VI[s.day_of_week] ?? '?';
  const time = `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`;
  const remind = s.reminder_1_min != null ? ` ⏱️ ${s.reminder_1_min}p` : '';
  return `**${day} ${time}** — ${s.session_name ?? 'Bang Chiến'}${remind}`;
}

function _buildStatusLine(cfg, members) {
  const ok = !!cfg?.notification_channel_id && (members?.length ?? 0) > 0;
  if (ok) return '> 🟢 **Hệ thống sẵn sàng.** Bấm **➕ Mở Bang Chiến** bên dưới để điểm danh.';
  const steps = [];
  if (!cfg?.notification_channel_id) steps.push('⬜ Cài đặt kênh + múi giờ');
  if (!members?.length) steps.push('⬜ Thêm thành viên');
  return `> ⚠️ **Cần hoàn tất:** ${steps.join(' · ')}`;
}

function render({ guild, cfg, schedules, members, session, sessions }) {
  const activeSessions = sessions ?? (session ? [session] : []);
  const cnt = activeSessions.length;
  const tz  = cfg?.timezone ?? 'Asia/Ho_Chi_Minh';
  const hasChannel = !!cfg?.notification_channel_id;
  const hasMembers = (members?.length ?? 0) > 0;

  const phaiIds = cfg?.phai_role_ids ?? [];
  let phaiLine = '';
  if (phaiIds.length && members?.length) {
    phaiLine = phaiIds.map(rid => {
      const count = members.filter(m => (m.phai_role_ids ?? []).includes(rid)).length;
      const icon  = getPhaiIcon(rid, phaiIds, guild, cfg?.phai_role_icons);
      const role  = guild?.roles?.cache?.get(rid);
      return count > 0 ? `${icon} ${role?.name ?? rid}: ${count}` : null;
    }).filter(Boolean).join(' · ');
  }

  let desc = _buildStatusLine(cfg, members);
  desc += `\n📡 ${hasChannel ? `<#${cfg.notification_channel_id}>` : '🔴 Chưa cài'} · 🌐 \`${tz}\``;
  desc += `\n${ICONS.MEMBER} **${members?.length ?? 0}** quân${phaiLine ? ` · ${phaiLine}` : ''}${phaiIds.length ? ` · ⚔️ **${phaiIds.length}** phái` : ''}`;

  // Active session indicator
  if (cnt > 0) {
    const s    = activeSessions[0];
    const ch   = s.channel_id ? `<#${s.channel_id}>` : '?';
    const by   = s.started_by ? `<@${s.started_by}>` : '?';
    const name = s.session_name ?? 'Bang Chiến';
    const extras = cnt > 1 ? ` +${cnt - 1} Bang Chiến khác` : '';
    desc += `\n🟢 **${name}**${extras} · ${ch} · ${by}`;
  }

  // Schedule summary
  if (schedules?.length) {
    const top = schedules.slice(0, 2).map((s, i) => `　${i + 1}. ${_fmtSchedule(s)}`).join('\n');
    const more = schedules.length > 2 ? `　_+${schedules.length - 2} lịch khác_` : '';
    desc += `\n📅 **Lịch (${schedules.length})**\n${top}${more}`;
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setAuthor(buildAuthor(guild))
    .setTitle('⚔️ Trung Tâm Chỉ Huy — Bang Chiến')
    .setThumbnail(guild.iconURL({ size: 64 }) ?? null)
    .setDescription(desc)
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  const primaryRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.SESSION).setLabel('⚔️ Bang Chiến').setStyle(cnt > 0 ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.STATS).setLabel('🏆 BXH').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.AUDIT).setLabel('📜 Log').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.CFG).setLabel('Cài Đặt').setEmoji(ICONS.GEAR).setStyle(hasChannel ? ButtonStyle.Secondary : ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.MEM).setLabel('Quân Số').setEmoji(ICONS.MEMBER).setStyle(hasMembers ? ButtonStyle.Secondary : ButtonStyle.Primary),
  );

  const secondaryRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.START).setLabel('Mở Bang Chiến').setEmoji(ICONS.PLUS).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(CUSTOM_ID.SCH).setLabel('Lịch').setEmoji(ICONS.CALENDAR).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.HISTORY).setLabel('Nhật Ký').setEmoji(ICONS.CHART).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.BROADCAST).setLabel('Phát Tin').setEmoji(ICONS.BELL).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.REFRESH).setLabel('Làm Mới').setEmoji(ICONS.REFRESH).setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [primaryRow, secondaryRow] };
}

module.exports = { HomeView: { render, CUSTOM_ID } };
