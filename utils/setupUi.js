// utils/setupUi.js
// Thành phần UI dùng chung cho các view /setup — giữ nhất quán giữa các màn hình
'use strict';
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ICONS } = require('./theme.js');

const BACK_HOME_LABEL = 'Cài Đặt Bot';

function setupNavRow(refreshId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(refreshId).setLabel('Làm mới').setEmoji(ICONS.REFRESH).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup:home').setLabel(BACK_HOME_LABEL).setEmoji(ICONS.HOME).setStyle(ButtonStyle.Secondary),
  );
}

module.exports = { setupNavRow, BACK_HOME_LABEL };