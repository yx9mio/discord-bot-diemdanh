'use strict';
// interaction-handlers/setup/setupConfigEdit.js
// Button handler: mở modal hoặc select menu chỉnh sửa cài đặt chung
const {
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelType,
} = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');

const EDIT_CHANNEL         = 'setup:cfg:edit:channel';
const EDIT_PHAI            = 'setup:cfg:edit:phai';
const EDIT_TZ              = 'setup:cfg:edit:tz';
const EDIT_REMINDER        = 'setup:cfg:edit:reminder';
const EDIT_ADMIN_ROLE      = 'setup:cfg:edit:admin_role';
const EDIT_ATTENDANCE_ROLE = 'setup:cfg:edit:attendance_role';

const EDIT_IDS = new Set([
  EDIT_CHANNEL, EDIT_PHAI, EDIT_TZ,
  EDIT_REMINDER, EDIT_ADMIN_ROLE, EDIT_ATTENDANCE_ROLE,
]);

const MODAL_PREFIX  = 'setup:cfg:modal:';
const SELECT_PREFIX = 'setup:cfg:select:';

function handleButton(interaction) {
  const id = interaction.customId;

  // --- Kênh thông báo: ChannelSelectMenu (chỉ text channel) ---
  if (id === EDIT_CHANNEL) {
    const menu = new ChannelSelectMenuBuilder()
      .setCustomId(SELECT_PREFIX + 'channel')
      .setPlaceholder('Chọn kênh thông báo điểm danh...')
      .addChannelTypes(ChannelType.GuildText)
      .setMinValues(1)
      .setMaxValues(1);
    return interaction.reply({
      content: '📢 Chọn kênh sẽ dùng làm **kênh thông báo điểm danh**:',
      components: [new ActionRowBuilder().addComponents(menu)],
      flags: MessageFlags.Ephemeral,
    });
  }

  // --- Phái: RoleSelectMenu (multi, max 20) ---
  if (id === EDIT_PHAI) {
    const menu = new RoleSelectMenuBuilder()
      .setCustomId(SELECT_PREFIX + 'phai')
      .setPlaceholder('Chọn các role phái...')
      .setMinValues(0)
      .setMaxValues(20);
    return interaction.reply({
      content: '⚔️ Chọn các **role phái** (có thể chọn nhiều, bỏ trống để xoá hết):',
      components: [new ActionRowBuilder().addComponents(menu)],
      flags: MessageFlags.Ephemeral,
    });
  }

  // --- Role Quản lý: RoleSelectMenu (single) ---
  if (id === EDIT_ADMIN_ROLE) {
    const menu = new RoleSelectMenuBuilder()
      .setCustomId(SELECT_PREFIX + 'admin_role')
      .setPlaceholder('Chọn role quản lý...')
      .setMinValues(0)
      .setMaxValues(1);
    return interaction.reply({
      content: '🛡️ Chọn **role quản lý** (bỏ trống = xoá):',
      components: [new ActionRowBuilder().addComponents(menu)],
      flags: MessageFlags.Ephemeral,
    });
  }

  // --- Role Điểm danh: RoleSelectMenu (single) ---
  if (id === EDIT_ATTENDANCE_ROLE) {
    const menu = new RoleSelectMenuBuilder()
      .setCustomId(SELECT_PREFIX + 'attendance_role')
      .setPlaceholder('Chọn role điểm danh...')
      .setMinValues(0)
      .setMaxValues(1);
    return interaction.reply({
      content: '✅ Chọn **role điểm danh** (bỏ trống = xoá):',
      components: [new ActionRowBuilder().addComponents(menu)],
      flags: MessageFlags.Ephemeral,
    });
  }

  // --- Timezone: Modal ---
  if (id === EDIT_TZ) {
    const modal = new ModalBuilder()
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
    return interaction.showModal(modal);
  }

  // --- Nhắc nhở: Modal ---
  if (id === EDIT_REMINDER) {
    const modal = new ModalBuilder()
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
    return interaction.showModal(modal);
  }

  return interaction.reply({
    content: '❌ Hành động không xác định.',
    flags: MessageFlags.Ephemeral,
  });
}

class SetupConfigEditHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (EDIT_IDS.has(interaction.customId)) return this.some();
    return this.none();
  }

  run(interaction) {
    return handleButton(interaction);
  }
}

module.exports = SetupConfigEditHandler;
