// src/commands/setup/_views/_HomeView.js
// [REDESIGN] Rewrite hoàn toàn: fix import path, thêm handleRefresh, chuẩn hóa pattern
'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, ICONS } = require('../../../../utils/theme.js');
const { FOOTER_DEFAULT } = require('../../../../utils/embeds.js');
const { DAY_NAMES: DAY_VI } = require('../../../../utils/format.js');

const CUSTOM_ID = {
  HOME:      'setup:home',
  CFG:       'setup:cfg',
  SCH:       'setup:sch',
  MEM:       'setup:mem',
  SESSION:   'setup:session:close',
  START:     'setup:session:start',
  REFRESH:   'setup:home:refresh',
  HISTORY:   'setup:history',
  BROADCAST: 'setup:session:broadcast',
  STATS:     'setup:stats',
};

// ─── Section renderers ────────────────────────────────────────────────

function _fmtSchedule(s) {
  const day  = DAY_VI[s.day_of_week] ?? '?';
  const time = `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`;
  const remind = s.reminder_1_min != null ? ` · ⏱️ ${s.reminder_1_min}p` : '';
  return `**${day} ${time}** — ${s.session_name ?? 'Phiên'}${remind}`;
}

function _sessionSection(session) {
  if (!session) {
    return [
      `*${ICONS.SESSION} Chưa có phiên nào đang mở.*`,
      `> Bấm **${ICONS.PLUS} Mở phiên mới** để bắt đầu.`,
    ].join('\n');
  }
  const ch      = session.channel_id ? `<#${session.channel_id}>` : '_chưa có_';
  const startTs = Math.floor(new Date(session.started_at ?? Date.now()).getTime() / 1000);
  const by      = session.started_by ? `<@${session.started_by}>` : 'không rõ';
  return [
    `${ICONS.SESSION} **${session.session_name}** đang mở`,
    `▸ Bắt đầu: <t:${startTs}:R>  ·  Kênh: ${ch}`,
    `▸ Mở bởi: ${by}`,
  ].join('\n');
}

function _configSection(cfg) {
  const tz      = cfg?.timezone ?? 'Asia/Ho_Chi_Minh';
  const channel = cfg?.notification_channel_id ? `<#${cfg.notification_channel_id}>` : '_chưa cài_';
  const phai    = (cfg?.phai_role_ids ?? []).length
    ? cfg.phai_role_ids.map(r => `<@&${r}>`).join(' ')
    : '_Tất cả_';
  return [
    `▸ ${ICONS.CHANNEL} **Kênh log:** ${channel}`,
    `▸ ${ICONS.ROLE} **Phái:** ${phai}`,
    `▸ ${ICONS.GLOBE} **Timezone:** \`${tz}\``,
  ].join('\n');
}

function _scheduleSection(schedules) {
  if (!schedules.length) {
    return [
      `*${ICONS.CALENDAR} Chưa có lịch cố định.*`,
      `> Bấm **${ICONS.PLUS} Quản lý lịch** để thêm.`,
    ].join('\n');
  }
  const top  = schedules.slice(0, 3).map((s, i) => `${i + 1}. ${_fmtSchedule(s)}`).join('\n');
  const more = schedules.length > 3 ? `\n_...và ${schedules.length - 3} lịch khác_` : '';
  return `${ICONS.CALENDAR} **${schedules.length} lịch cố định**\n${top}${more}`;
}

function _memberSection(members) {
  return `${ICONS.MEMBER} **${members.length} thành viên** đang quản lý`;
}

// ─── Main render ─────────────────────────────────────────────────────

function render({ guild, cfg, schedules, members, session }) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`${ICONS.HOME} Bảng điều khiển — ${guild.name}`)
    .setDescription([
      '**🟢 Phiên đang mở**',
      _sessionSection(session),
      '',
      `**${ICONS.GEAR} Cài đặt chung**`,
      _configSection(cfg),
      '',
      `**${ICONS.CALENDAR} Lịch cố định**`,
      _scheduleSection(schedules),
      '',
      `**${ICONS.MEMBER} Thành viên**`,
      _memberSection(members),
    ].join('\n'))
    .setThumbnail(guild.iconURL({ size: 64 }) ?? null)
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.CFG).setLabel('Cài đặt').setEmoji(ICONS.GEAR).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.SCH).setLabel('Lịch cố định').setEmoji(ICONS.CALENDAR).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.MEM).setLabel('Thành viên').setEmoji(ICONS.MEMBER).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.HISTORY).setLabel('Nhật ký').setEmoji(ICONS.CHART).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.STATS).setLabel('Thống kê').setEmoji(ICONS.TROPHY).setStyle(ButtonStyle.Secondary),
  );

  const sessionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.START).setLabel('Mở phiên mới').setEmoji(ICONS.PLUS).setStyle(ButtonStyle.Success).setDisabled(!!session),
    new ButtonBuilder().setCustomId(CUSTOM_ID.REFRESH).setLabel('Làm mới').setEmoji(ICONS.REFRESH).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.SESSION).setLabel('Đóng phiên').setEmoji(ICONS.CLOSE).setStyle(session ? ButtonStyle.Danger : ButtonStyle.Secondary).setDisabled(!session),
    new ButtonBuilder().setCustomId(CUSTOM_ID.BROADCAST).setLabel('Phát tin').setEmoji(ICONS.BELL).setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [navRow, sessionRow] };
}

module.exports = { HomeView: { render, CUSTOM_ID } };
