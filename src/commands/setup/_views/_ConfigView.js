'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, ICONS } = require('../../../../utils/theme.js');
const { FOOTER_DEFAULT } = require('../../../../utils/embeds.js');

// Lưu messageId của ConfigView để các edit handler có thể fetch và update
const _configMsgIds = new Map(); // guildId → messageId

function storeMessageId(guildId, messageId) {
  _configMsgIds.set(guildId, messageId);
}
function getMessageId(guildId) {
  return _configMsgIds.get(guildId);
}

const CUSTOM_ID = {
  EDIT_CHANNEL:         'setup:cfg:edit:channel',
  EDIT_TZ:              'setup:cfg:edit:tz',
  EDIT_ADMIN_ROLE:      'setup:cfg:edit:admin_role',
  EDIT_ATTENDANCE_ROLE: 'setup:cfg:edit:attendance_role',
  EDIT_PHAI:            'setup:cfg:edit:phai',
  EDIT_PHAI_ICON:       'setup:cfg:edit:phai_icon',
  REFRESH:              'setup:cfg:refresh',
  BACK_HOME:            'setup:home',
};

function render({ cfg, guild }) {
  const tz        = cfg?.timezone ?? 'Asia/Ho_Chi_Minh';
  const channel   = cfg?.notification_channel_id ? `<#${cfg.notification_channel_id}>` : '_chưa cài_';
  const adminRole = cfg?.admin_role_id ? `<@&${cfg.admin_role_id}>` : '_chưa cài_';
  const attRole   = cfg?.attendance_role_id ? `<@&${cfg.attendance_role_id}>` : '_chưa cài_';

  const phaiIds = cfg?.phai_role_ids ?? [];
  const phaiIcons = cfg?.phai_role_icons ?? {};
  const phaiStr = phaiIds.length
    ? phaiIds.map(id => `${phaiIcons[id] ?? ICONS.SWORD} <@&${id}>`).join(' ')
    : '_Không có_';

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
    { name: `${ICONS.GEAR} Phái / Nhóm`, value: phaiStr, inline: false },
  );

  // Role edit row — max 5 buttons per row
  const roleRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.EDIT_ADMIN_ROLE).setLabel('Role Quản lý').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.EDIT_ATTENDANCE_ROLE).setLabel('Role Điểm danh').setEmoji(ICONS.CHECK).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.EDIT_PHAI).setLabel('Phái / Nhóm').setEmoji(ICONS.SWORD).setStyle(ButtonStyle.Secondary),
  );

  const phaiRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.EDIT_PHAI_ICON).setLabel('Icon phái').setEmoji('🎨').setStyle(ButtonStyle.Secondary).setDisabled(!phaiIds.length),
    new ButtonBuilder().setCustomId(CUSTOM_ID.EDIT_CHANNEL).setLabel('Kênh thông báo').setEmoji(ICONS.CHANNEL).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.EDIT_TZ).setLabel('Timezone').setEmoji(ICONS.GLOBE).setStyle(ButtonStyle.Secondary),
  );

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.REFRESH).setLabel('Làm mới').setEmoji(ICONS.REFRESH).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.BACK_HOME).setLabel('← Dashboard').setEmoji(ICONS.HOME).setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [roleRow, phaiRow, navRow] };
}

module.exports = { ConfigView: { render, CUSTOM_ID, storeMessageId, getMessageId } };
