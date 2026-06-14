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
const { wrapHandler } = require('../../../utils/error-boundary.js');
const { checkCooldown } = require('../../../utils/cooldown.js');

const EDIT_CHANNEL         = 'setup:cfg:edit:channel';
const EDIT_TZ              = 'setup:cfg:edit:tz';
const EDIT_ADMIN_ROLE      = 'setup:cfg:edit:admin_role';
const EDIT_ATTENDANCE_ROLE = 'setup:cfg:edit:attendance_role';
const EDIT_PHAI            = 'setup:cfg:edit:phai';
const EDIT_EMOJI_NAME      = 'setup:cfg:edit:emoji_name';

const EDIT_IDS = new Set([
  EDIT_CHANNEL, EDIT_TZ,
  EDIT_ADMIN_ROLE, EDIT_ATTENDANCE_ROLE,
  EDIT_PHAI, EDIT_EMOJI_NAME,
]);

const MODAL_PREFIX  = 'setup:cfg:modal:';
const SELECT_PREFIX = 'setup:cfg:select:';

async function handleButton(interaction) {
  const id = interaction.customId;

  if (id === EDIT_CHANNEL) {
    await interaction.deferUpdate();
    if (!checkCooldown(interaction.user.id, 'setup_cfg_edit', 1000)) {
      return interaction.editReply({ content: '⏳ Vui lòng đợi một chút trước khi thực hiện hành động này.' });
    }
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
    if (!checkCooldown(interaction.user.id, 'setup_cfg_edit', 1000)) {
      return interaction.editReply({ content: '⏳ Vui lòng đợi một chút trước khi thực hiện hành động này.' });
    }
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
    if (!checkCooldown(interaction.user.id, 'setup_cfg_edit', 1000)) {
      return interaction.editReply({ content: '⏳ Vui lòng đợi một chút trước khi thực hiện hành động này.' });
    }
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
    if (!checkCooldown(interaction.user.id, 'setup_cfg_edit', 1000)) {
      return interaction.editReply({ content: '⏳ Vui lòng đợi một chút trước khi thực hiện hành động này.' });
    }
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

  if (id === EDIT_EMOJI_NAME) {
    if (!checkCooldown(interaction.user.id, 'setup_cfg_edit', 1000)) {
      return interaction.reply({ content: '⏳ Vui lòng đợi một chút trước khi thực hiện hành động này.', flags: MessageFlags.Ephemeral });
    }
    const cfg = await configService.getGuildConfig(interaction.guild.id);
    const phaiIds = cfg?.phai_role_ids ?? [];
    if (!phaiIds.length) {
      return interaction.reply({ content: '❌ Chưa có phái / nhóm nào. Thêm phái trước.', flags: MessageFlags.Ephemeral });
    }
    const emojiMap = cfg?.phai_role_icons ?? {};
    const lines = phaiIds.map(id => {
      const role = interaction.guild.roles.cache.get(id);
      const name = role?.name ?? id;
      const val = emojiMap[id] ?? '';
      return `${name}=${val}`;
    });
    const modal = new ModalBuilder()
      .setCustomId(MODAL_PREFIX + 'emoji_name')
      .setTitle('Tên emoji Discord cho phái')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('emoji_names')
            .setLabel('Mỗi dòng: TênPhái=TênEmoji')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Cửu Linh=TY\nThiết Y=TY\nHồng Âm=HA')
            .setRequired(false)
            .setMaxLength(2000)
            .setValue(lines.join('\n')),
        ),
      );
    return interaction.showModal(modal);
  }

  if (id === EDIT_TZ) {
    if (!checkCooldown(interaction.user.id, 'setup_cfg_edit', 1000)) {
      return interaction.reply({ content: '⏳ Vui lòng đợi một chút trước khi thực hiện hành động này.', flags: MessageFlags.Ephemeral });
    }
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
    return wrapHandler(async (interaction) => {
    try {
      await handleButton(interaction);
    } catch (e) {
      log.error('SETUP_CFG_EDIT', interaction.guild?.id, 'Config edit thất bại: %s', e.message);
      if (interaction.replied || interaction.deferred) {
        return interaction.editReply({ content: '❌ Lỗi xử lý, thử lại sau.' }).catch(() => null);
      }
      return interaction.reply({ content: '❌ Lỗi xử lý, thử lại sau.', flags: MessageFlags.Ephemeral }).catch(() => null);
    }
  }, 'SetupConfigEditHandler')(interaction); }
}

module.exports = SetupConfigEditHandler;
