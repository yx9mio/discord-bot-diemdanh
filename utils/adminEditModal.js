// utils/adminEditModal.js
// Modal builder cho admin sửa điểm danh (giống admin:mark nhưng label khác)
'use strict';
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

const STATUS_PLACEHOLDER = 'tham_gia / tre / khong_tham_gia / co_phep';

function buildAdminEditModal(currentStatus) {
  return new ModalBuilder()
    .setCustomId('admin:edit:modal')
    .setTitle('Sửa điểm danh')
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
          .setLabel('Trạng thái mới')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder(STATUS_PLACEHOLDER)
          .setValue(currentStatus ?? '')
          .setRequired(true),
      ),
    );
}

module.exports = { buildAdminEditModal };
