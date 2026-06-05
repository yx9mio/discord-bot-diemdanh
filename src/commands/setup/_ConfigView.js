// src/commands/setup/ConfigView.js
// Render trang cài đặt chung: Kênh thông báo / Role / Phái / Timezone / Nhắc nhở.
'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, ICONS } = require('../../../utils/theme.js');
const { FOOTER_DEFAULT } = require('../../../utils/embeds.js');

const CUSTOM_ID = {
  EDIT_CHANNEL:       'setup:cfg:edit:channel',
  EDIT_PHAI:          'setup:cfg:edit:phai',
  EDIT_TZ:            'setup:cfg:edit:tz',
  EDIT_REMINDER:      'setup:cfg:edit:reminder',
  EDIT_ADMIN_ROLE:    'setup:cfg:edit:admin_role',
  EDIT_ATTENDANCE_ROLE: 'setup:cfg:edit:attendance_role',
  BACK_HOME:          'setup:home',
};

function renderConfigSection(cfg) {
  const tz      = cfg?.timezone ?? 'Asia/Ho_Chi_Minh';
  const channel = cfg?.notification_channel_id ? `<#${cfg.notification_channel_id}>` : '_chưa cài_';
  const phai    = (cfg?.phai_role_ids ?? []).length
    ? cfg.phai_role_ids.map(r => `<@&${r}>`).join(' ')
    : '_Tất cả_';
  const adminRole = cfg?.admin_role_id ? `<@&${cfg.admin_role_id}>` : '_chưa cài_';
  const attRole   = cfg?.attendance_role_id ? `<@&${cfg.attendance_role_id}>` : '_chưa cài_';
  const reminder  = cfg?.reminder_enabled === false
    ? '⛔ Tắt'
    : `✅ ${cfg?.reminder_minutes ?? 10} phút trước`;
  return [
    `▸ ${ICONS.CHANNEL} **Kênh thông báo:** ${channel}`,
    `▸ 🛡️ **Role Quản lý:** ${adminRole}`,
    `▸ ${ICONS.ROLE} **Phái:** ${phai}`,
    `▸ ${ICONS.CHECK} **Role Điểm danh:** ${attRole}`,
    `▸ ${ICONS.GLOBE} **Timezone:** \`${tz}\``,
    `▸ ${ICONS.BELL} **Nhắc nhở:** ${reminder}`,
  ].join('\n');
}

function render({ cfg, guild }) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`${ICONS.GEAR} Cài đặt chung — ${guild.name}`)
    .setDescription(renderConfigSection(cfg))
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  // Row 1: 4 nút edit cơ bản
  const editRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.EDIT_CHANNEL)
      .setLabel('Kênh thông báo')
      .setEmoji(ICONS.CHANNEL)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.EDIT_PHAI)
      .setLabel('Phái')
      .setEmoji(ICONS.ROLE)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.EDIT_TZ)
      .setLabel('Timezone')
      .setEmoji(ICONS.GLOBE)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.EDIT_REMINDER)
      .setLabel('Nhắc nhở')
      .setEmoji(ICONS.BELL)
      .setStyle(ButtonStyle.Secondary),
  );

  // Row 2: nút edit role
  const roleRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.EDIT_ADMIN_ROLE)
      .setLabel('Role Quản lý')
      .setEmoji('🛡️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.EDIT_ATTENDANCE_ROLE)
      .setLabel('Role Điểm danh')
      .setEmoji(ICONS.CHECK)
      .setStyle(ButtonStyle.Secondary),
  );

  // Row 3: Back
  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.BACK_HOME)
      .setLabel('← Về Bảng điều khiển')
      .setEmoji(ICONS.HOME)
      .setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [editRow, roleRow, backRow] };
}

module.exports = { ConfigView: { render, CUSTOM_ID } };
