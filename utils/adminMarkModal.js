// utils/adminMarkModal.js
// [C1] Modal builder dùng chung cho admin điểm danh thay
'use strict';
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

function buildAdminMarkModal() {
  return new ModalBuilder()
    .setCustomId('admin:mark:modal')
    .setTitle('Điểm danh thay')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('user_id')
          .setLabel('User ID hoặc @mention')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('VD: 123456789012345678 hoặc @user')
          .setRequired(true),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('status')
          .setLabel('Trạng thái')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('tham_gia / tre / khong_tham_gia / co_phep')
          .setRequired(true),
      ),
    );
}

module.exports = { buildAdminMarkModal };
