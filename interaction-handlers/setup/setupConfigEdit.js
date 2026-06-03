'use strict';
// interaction-handlers/setup/setupConfigEdit.js
// Button handler: mở modal chỉnh sửa cài đặt chung (kênh log, phái, tz, reminder, role)
// [FIX] Tách khỏi setupConfigEditModal.js — Sapphire v3 chỉ load 1 class per file
const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');

const EDIT_CHANNEL        = 'setup:cfg:edit:channel';
const EDIT_PHAI           = 'setup:cfg:edit:phai';
const EDIT_TZ             = 'setup:cfg:edit:tz';
const EDIT_REMINDER       = 'setup:cfg:edit:reminder';
const EDIT_ADMIN_ROLE     = 'setup:cfg:edit:admin_role';
const EDIT_ATTENDANCE_ROLE = 'setup:cfg:edit:attendance_role';

const EDIT_IDS = new Set([
  EDIT_CHANNEL, EDIT_PHAI, EDIT_TZ,
  EDIT_REMINDER, EDIT_ADMIN_ROLE, EDIT_ATTENDANCE_ROLE,
]);

// MODAL_PREFIX được define lại ở cả 2 file (setupConfigEditModal.js cũng có cùng giá trị)
const MODAL_PREFIX = 'setup:cfg:modal:';

function openEditModal(interaction) {
  const id = interaction.customId;
  let modal;

  if (id === EDIT_CHANNEL) {
    modal = new ModalBuilder()
      .setCustomId(MODAL_PREFIX + 'channel')
      .setTitle('Cài đặt Kênh log')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('channel_id')
            .setLabel('Channel ID')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('VD: 123456789012345678')
            .setRequired(true),
        ),
      );
  } else if (id === EDIT_PHAI) {
    modal = new ModalBuilder()
      .setCustomId(MODAL_PREFIX + 'phai')
      .setTitle('Cài đặt Phái (Role)')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('role_ids')
            .setLabel('Role IDs (cách nhau bằng dấu phẩy)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('VD: 111111111111,222222222222')
            .setRequired(false),
        ),
      );
  } else if (id === EDIT_TZ) {
    modal = new ModalBuilder()
      .setCustomId(MODAL_PREFIX + 'tz')
      .setTitle('Cài đặt Timezone')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('timezone')
            .setLabel('Timezone (VD: Asia/Ho_Chi_Minh)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Asia/Ho_Chi_Minh')
            .setRequired(true),
        ),
      );
  } else if (id === EDIT_REMINDER) {
    modal = new ModalBuilder()
      .setCustomId(MODAL_PREFIX + 'reminder')
      .setTitle('Cài đặt Nhắc nhở')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('reminder_minutes')
            .setLabel('Số phút nhắc trước giờ mở (0 = tắt)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('5 / 10 / 15 / 30 / 60'),
        ),
      );
  } else if (id === EDIT_ADMIN_ROLE) {
    modal = new ModalBuilder()
      .setCustomId(MODAL_PREFIX + 'admin_role')
      .setTitle('Cài đặt Role Quản lý')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('role_id')
            .setLabel('Role ID')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('VD: 123456789012345678')
            .setRequired(false),
        ),
      );
  } else if (id === EDIT_ATTENDANCE_ROLE) {
    modal = new ModalBuilder()
      .setCustomId(MODAL_PREFIX + 'attendance_role')
      .setTitle('Cài đặt Role Điểm danh')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('role_id')
            .setLabel('Role ID')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('VD: 123456789012345678')
            .setRequired(false),
        ),
      );
  }

  if (!modal) {
    return interaction.reply({
      content: '❌ Hành động không xác định.',
      flags: MessageFlags.Ephemeral,
    });
  }
  return interaction.showModal(modal);
}

class SetupConfigEditHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (EDIT_IDS.has(interaction.customId)) return this.some();
    return this.none();
  }

  // showModal là synchronous nên không cần async
  run(interaction) {
    return openEditModal(interaction);
  }
}

// [FIX] module.exports = Class — Sapphire v3 yêu cầu, không phải export object
module.exports = SetupConfigEditHandler;
