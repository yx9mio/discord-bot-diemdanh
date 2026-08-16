// utils/adminEditModal.js
// Modal builder cho admin sửa điểm danh (giống admin:mark nhưng label khác)
// [FIX] Nhúng sessionId vào customId modal để submit đúng Kỳ khi multi-session
'use strict';
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

const STATUS_PLACEHOLDER = 'tham_gia / tre / khong_tham_gia / co_phep';

function buildAdminEditModal(currentStatus, sessionId) {
  return new ModalBuilder()
    .setCustomId(sessionId ? `admin:edit:modal:${sessionId}` : 'admin:edit:modal')
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

async function showAdminEditModal(interaction, sessionId = null) {
  return interaction.showModal(buildAdminEditModal(undefined, sessionId));
}

module.exports = { buildAdminEditModal, showAdminEditModal };
