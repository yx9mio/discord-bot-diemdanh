// src/commands/setup/HomeView.js
// Render Smart Home dashboard với 5 sections:
//  1. Live session (nếu đang mở) + quick actions
//  2. Cài đặt chung (Kênh/Role/Phái/TZ/Reminder)
//  3. Lịch cố định (count + first 3 + drill-down)
//  4. Thành viên (count)
//  5. Nhật ký (recent 5 sessions)
'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, ICONS } = require('../../../../utils/theme.js');
const { FOOTER_DEFAULT } = require('../../../../utils/embeds.js');
const { DAY_NAMES: DAY_VI } = require('../../../../utils/format.js');

const CUSTOM_ID = {
  HOME:       'setup:home',
  CFG:        'setup:cfg',
  SCH:        'setup:sch',
  MEM:        'setup:mem',
  SESSION:    'setup:session:close',
  START:      'setup:session:start',
  REFRESH:    'setup:home:refresh',
  HISTORY:    'setup:history',
  BROADCAST:  'setup:session:broadcast',
  STATS:      'setup:stats',
};

// [FIX-SETUP] Không có cột pre_close_minutes — dùng reminder_1_min/reminder_2_min
function fmtSchedule(s) {
  const r1 = s.reminder_1_min != null ? ` · ⏱️ ${s.reminder_1_min}p` : '';
  return `**${DAY_VI[s.day_of_week]} ${String(s.hour).padStart(2,'0')}:${String(s.minute).padStart(2,'0')}** — ${s.session_name ?? 'Phiên'}${r1}`;
}

function renderLiveSessionSection(session, _guild) {
  if (!session) {
    return `*${ICONS.SESSION} Chưa có phiên nào đang mở.*\n> Bấm **${ICONS.PLUS} Mở phiên mới** để bắt đầu hoặc chờ lịch cố định tự mở.`;
  }
  const ch = session.channel_id ? `<#${session.channel_id}>` : '_chưa có_';
  // [FIX-SETUP] sessions không có cột created_at — dùng started_at
  const startTs = Math.floor(new Date(session.started_at ?? Date.now()).getTime() / 1000);
  return [
    `${ICONS.SESSION} **${session.session_name}** đang mở`,
    `▸ Bắt đầu: <t:${startTs}:R>  ·  Kênh: ${ch}`,
    `▸ Mở bởi: ${session.started_by ? `<@${session.started_by}>` : 'không rõ'}`,
  ].join('\n');
}

function renderConfigSection(cfg) {
  const tz = cfg?.timezone ?? 'Asia/Ho_Chi_Minh';
  // [FIX] dùng đúng column notification_channel_id thay vì log_channel_id
  const channel = cfg?.notification_channel_id ? `<#${cfg.notification_channel_id}>` : '_chưa cài_';
  const phai = (cfg?.phai_role_ids ?? []).length
    ? cfg.phai_role_ids.map(r => `<@&${r}>`).join(' ')
    : '_Tất cả_';
  return [
    `▸ ${ICONS.CHANNEL} **Kênh log:** ${channel}`,
    `▸ ${ICONS.ROLE} **Phái:** ${phai}`,
    `▸ ${ICONS.GLOBE} **Timezone:** \`${tz}\``,
  ].join('\n');
}

function renderScheduleSection(schedules) {
  if (!schedules.length) {
    return `*${ICONS.CALENDAR} Chưa có lịch cố định.*\n> Bấm **${ICONS.PLUS} Quản lý lịch** để thêm.`;
  }
  const top = schedules.slice(0, 3).map((s, i) => `${i + 1}. ${fmtSchedule(s)}`).join('\n');
  const more = schedules.length > 3 ? `\n_...và ${schedules.length - 3} lịch khác_` : '';
  return `${ICONS.CALENDAR} **${schedules.length} lịch cố định**\n${top}${more}`;
}

function renderMemberSection(members) {
  const count = members.length;
  return `${ICONS.MEMBER} **${count} thành viên** đang quản lý`;
}

function render({ guild, cfg, schedules, members, session }) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`${ICONS.HOME} Bảng điều khiển — ${guild.name}`)
    .setDescription(
      [
        `**🟢 Phiên đang mở**`,
        renderLiveSessionSection(session, guild),
        '',
        `**${ICONS.GEAR} Cài đặt chung**`,
        renderConfigSection(cfg),
        '',
        `**${ICONS.CALENDAR} Lịch cố định**`,
        renderScheduleSection(schedules),
        '',
        `**${ICONS.MEMBER} Thành viên**`,
        renderMemberSection(members),
      ].join('\n')
    )
    .setThumbnail(guild.iconURL({ size: 64 }))
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  // Row 1: drill-down
  const drilldown = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.CFG)
      .setLabel('Cài đặt chung')
      .setEmoji(ICONS.GEAR)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.SCH)
      .setLabel('Lịch cố định')
      .setEmoji(ICONS.CALENDAR)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.MEM)
      .setLabel('Thành viên')
      .setEmoji(ICONS.MEMBER)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.HISTORY)
      .setLabel('Nhật ký')
      .setEmoji(ICONS.CHART)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.STATS)
      .setLabel('Thống kê')
      .setEmoji('🏆')
      .setStyle(ButtonStyle.Secondary),
  );

  // Row 2: session actions
  const sessionBtns = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.START)
      .setLabel('Mở phiên mới')
      .setEmoji(ICONS.PLUS)
      .setStyle(ButtonStyle.Success)
      .setDisabled(!!session),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.REFRESH)
      .setLabel('Làm mới')
      .setEmoji(ICONS.REFRESH)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.SESSION)
      .setLabel(session ? 'Đóng phiên' : 'Đóng phiên')
      .setEmoji(ICONS.CLOSE)
      .setStyle(session ? ButtonStyle.Danger : ButtonStyle.Secondary)
      .setDisabled(!session),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.BROADCAST)
      .setLabel('Phát tin')
      .setEmoji('📢')
      .setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [drilldown, sessionBtns] };
}

module.exports = { HomeView: { render, CUSTOM_ID } };
