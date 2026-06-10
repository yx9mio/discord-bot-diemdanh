'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, ICONS } = require('../../../../utils/theme.js');
const { FOOTER_DEFAULT } = require('../../../../utils/embeds.js');

const CUSTOM_ID = {
  EDIT_CHANNEL:         'setup:cfg:edit:channel',
  EDIT_TZ:              'setup:cfg:edit:tz',
  EDIT_REMINDER:        'setup:cfg:edit:reminder',
  EDIT_ADMIN_ROLE:      'setup:cfg:edit:admin_role',
  EDIT_ATTENDANCE_ROLE: 'setup:cfg:edit:attendance_role',
  REFRESH:              'setup:cfg:refresh',
  BACK_HOME:            'setup:home',
};

function render({ cfg, guild }) {
  const tz        = cfg?.timezone ?? 'Asia/Ho_Chi_Minh';
  const channel   = cfg?.notification_channel_id ? `<#${cfg.notification_channel_id}>` : '_chưa cài_';
  const adminRole = cfg?.admin_role_id ? `<@&${cfg.admin_role_id}>` : '_chưa cài_';
  const attRole   = cfg?.attendance_role_id ? `<@&${cfg.attendance_role_id}>` : '_chưa cài_';
  const reminder  = cfg?.reminder_enabled === false
    ? '⛔ Tắt'
    : `✅ ${cfg?.reminder_minutes ?? 10} phút trước`;

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`${ICONS.GEAR} Cài đặt chung — ${guild.name}`)
    .setThumbnail(guild.iconURL({ size: 64 }) ?? null)
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  embed.addFields(
    { name: `${ICONS.CHANNEL} Kênh thông báo`, value: channel, inline: true },
    { name: '🛡️ Role Quản lý', value: adminRole, inline: true },
    { name: `${ICONS.CHECK} Role Điểm danh`, value: attRole, inline: true },
    { name: `${ICONS.GLOBE} Timezone`, value: `\`${tz}\``, inline: true },
    { name: `${ICONS.BELL} Nhắc nhở`, value: reminder, inline: true },
  );

  const editRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.EDIT_CHANNEL).setLabel('Kênh thông báo').setEmoji(ICONS.CHANNEL).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.EDIT_TZ).setLabel('Timezone').setEmoji(ICONS.GLOBE).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.EDIT_REMINDER).setLabel('Nhắc nhở').setEmoji(ICONS.BELL).setStyle(ButtonStyle.Secondary),
  );

  const roleRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.EDIT_ADMIN_ROLE).setLabel('Role Quản lý').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.EDIT_ATTENDANCE_ROLE).setLabel('Role Điểm danh').setEmoji(ICONS.CHECK).setStyle(ButtonStyle.Secondary),
  );

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.REFRESH).setLabel('Làm mới').setEmoji(ICONS.REFRESH).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.BACK_HOME).setLabel('← Dashboard').setEmoji(ICONS.HOME).setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [editRow, roleRow, navRow] };
}

module.exports = { ConfigView: { render, CUSTOM_ID } };
