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

const configService = require('../../../services/configService.js');
const log = require('../../../utils/logger.js');

const EDIT_CHANNEL         = 'setup:cfg:edit:channel';
const EDIT_TZ              = 'setup:cfg:edit:tz';
const EDIT_ADMIN_ROLE      = 'setup:cfg:edit:admin_role';
const EDIT_ATTENDANCE_ROLE = 'setup:cfg:edit:attendance_role';
const EDIT_PHAI            = 'setup:cfg:edit:phai';
const EDIT_PHAI_ICON       = 'setup:cfg:edit:phai_icon';

const EDIT_IDS = new Set([
  EDIT_CHANNEL, EDIT_TZ,
  EDIT_ADMIN_ROLE, EDIT_ATTENDANCE_ROLE,
  EDIT_PHAI, EDIT_PHAI_ICON,
]);

const MODAL_PREFIX  = 'setup:cfg:modal:';
const SELECT_PREFIX = 'setup:cfg:select:';

async function handleButton(interaction) {
  const id = interaction.customId;

  if (id === EDIT_CHANNEL) {
    await interaction.deferUpdate();
    const menu = new ChannelSelectMenuBuilder()
      .setCustomId(SELECT_PREFIX + 'channel')
      .setPlaceholder('Chọn kênh thông báo điểm danh...')
      .addChannelTypes(ChannelType.GuildText)
      .setMinValues(1)
      .setMaxValues(1);
    return interaction.editReply({
      embeds: [],
      content: '📢 Chọn kênh sẽ dùng làm **kênh thông báo điểm danh**:',
      components: [new ActionRowBuilder().addComponents(menu)],
    });
  }

  if (id === EDIT_ADMIN_ROLE) {
    await interaction.deferUpdate();
    const menu = new RoleSelectMenuBuilder()
      .setCustomId(SELECT_PREFIX + 'admin_role')
      .setPlaceholder('Chọn role quản lý...')
      .setMinValues(0)
      .setMaxValues(1);
    return interaction.editReply({
      embeds: [],
      content: '🛡️ Chọn **role quản lý** (bỏ trống = xoá):',
      components: [new ActionRowBuilder().addComponents(menu)],
    });
  }

  if (id === EDIT_ATTENDANCE_ROLE) {
    await interaction.deferUpdate();
    const menu = new RoleSelectMenuBuilder()
      .setCustomId(SELECT_PREFIX + 'attendance_role')
      .setPlaceholder('Chọn role điểm danh...')
      .setMinValues(0)
      .setMaxValues(1);
    return interaction.editReply({
      embeds: [],
      content: '✅ Chọn **role điểm danh** (bỏ trống = xoá):',
      components: [new ActionRowBuilder().addComponents(menu)],
    });
  }

  if (id === EDIT_PHAI) {
    await interaction.deferUpdate();
    const menu = new RoleSelectMenuBuilder()
      .setCustomId(SELECT_PREFIX + 'phai')
      .setPlaceholder('Chọn phái / nhóm...')
      .setMinValues(0)
      .setMaxValues(10);
    return interaction.editReply({
      embeds: [],
      content: '⚔️ Chọn **phái / nhóm** (có thể chọn nhiều, bỏ trống = xoá hết):',
      components: [new ActionRowBuilder().addComponents(menu)],
    });
  }

  if (id === EDIT_PHAI_ICON) {
    const cfg = await configService.getGuildConfig(interaction.guild.id);
    const phaiIds = cfg?.phai_role_ids ?? [];
    if (!phaiIds.length) {
      return interaction.reply({ content: '❌ Chưa có phái / nhóm nào. Thêm phái trước.', flags: MessageFlags.Ephemeral });
    }

    const phaiIcons = cfg?.phai_role_icons ?? {};
    const modal = new ModalBuilder()
      .setCustomId(MODAL_PREFIX + 'phai_icon')
      .setTitle('Icon phái / nhóm');

    for (let i = 0; i < Math.min(phaiIds.length, 5); i++) {
      const roleId = phaiIds[i];
      const role = interaction.guild.roles.cache.get(roleId);
      const name = role?.name ?? `Role ${roleId}`;
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId(`phai_icon:${roleId}`)
            .setLabel(`Icon ${name} (1 emoji)`)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(phaiIcons[roleId] ?? '⚔️')
            .setRequired(false)
            .setMaxLength(10),
        ),
      );
    }

    if (phaiIds.length > 5) {
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('phai_icon:note')
            .setLabel(`Còn ${phaiIds.length - 5} phái khác (giữ mặc định)`)
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue('...'),
        ),
      );
    }

    return interaction.showModal(modal);
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

  async run(interaction) {
    try {
      await handleButton(interaction);
    } catch (e) {
      log.error('SETUP_CFG_EDIT', interaction.guild?.id, 'Config edit thất bại: %s', e.message);
      if (interaction.replied || interaction.deferred) {
        return interaction.editReply({ content: '❌ Lỗi xử lý, thử lại sau.' }).catch(() => null);
      }
      return interaction.reply({ content: '❌ Lỗi xử lý, thử lại sau.', flags: MessageFlags.Ephemeral }).catch(() => null);
    }
  }
}

module.exports = SetupConfigEditHandler;
