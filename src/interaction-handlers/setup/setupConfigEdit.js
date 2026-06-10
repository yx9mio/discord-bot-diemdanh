'use strict';
// interaction-handlers/setup/setupConfigEdit.js
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
const EDIT_TZ              = 'setup:cfg:edit:tz';
const EDIT_ADMIN_ROLE      = 'setup:cfg:edit:admin_role';
const EDIT_ATTENDANCE_ROLE = 'setup:cfg:edit:attendance_role';

const EDIT_IDS = new Set([
  EDIT_CHANNEL, EDIT_TZ,
  EDIT_ADMIN_ROLE, EDIT_ATTENDANCE_ROLE,
]);

const MODAL_PREFIX  = 'setup:cfg:modal:';
const SELECT_PREFIX = 'setup:cfg:select:';

function handleButton(interaction) {
  const id = interaction.customId;

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
