'use strict';
const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const db = require('../../db.js');
const log = require('../../utils/logger.js');
const { requireAdmin } = require('../../utils/permissions.js');

const EDIT_CHANNEL = 'setup:cfg:edit:channel';
const EDIT_PHAI    = 'setup:cfg:edit:phai';
const EDIT_TZ      = 'setup:cfg:edit:tz';
const EDIT_REMINDER = 'setup:cfg:edit:reminder';

const EDIT_IDS = new Set([EDIT_CHANNEL, EDIT_PHAI, EDIT_TZ, EDIT_REMINDER]);
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
          new StringSelectMenuBuilder()
            .setCustomId('reminder_minutes')
            .setPlaceholder('Nhắc nhở trước giờ mở...')
            .addOptions(
              { label: 'Tắt nhắc nhở', value: '0' },
              { label: '5 phút', value: '5' },
              { label: '10 phút', value: '10', default: true },
              { label: '15 phút', value: '15' },
              { label: '30 phút', value: '30' },
              { label: '60 phút (1 giờ)', value: '60' },
            ),
        ),
      );
  }

  if (!modal) return interaction.reply({ content: '❌ Hành động không xác định.', flags: MessageFlags.Ephemeral });
  return interaction.showModal(modal);
}

async function handleEditModal(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const { ok } = await requireAdmin(interaction, { context: 'chỉnh sửa cấu hình' });
  if (!ok) return interaction.editReply({ content: '❌ Bạn không có quyền thực hiện hành động này.' });

  const guildId = interaction.guildId;
  const modalId = interaction.customId;
  const cfg = await db.getGuildConfig(guildId);

  try {
    if (modalId === MODAL_PREFIX + 'channel') {
      const channelId = interaction.fields.getTextInputValue('channel_id').trim();
      await db.setGuildConfig(guildId, { ...cfg, log_channel_id: channelId });
      log.info('SETUP_CFG', guildId, 'Cập nhật log_channel_id = %s', channelId);
      return interaction.editReply({ content: `✅ Đã cập nhật Kênh log thành <#${channelId}>.` });
    }

    if (modalId === MODAL_PREFIX + 'phai') {
      const raw = interaction.fields.getTextInputValue('role_ids').trim();
      const roleIds = raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : [];
      await db.setGuildConfig(guildId, { ...cfg, phai_role_ids: roleIds });
      log.info('SETUP_CFG', guildId, 'Cập nhật phai_role_ids = %s', roleIds);
      return interaction.editReply({ content: `✅ Đã cập nhật Phái (${roleIds.length} role).` });
    }

    if (modalId === MODAL_PREFIX + 'tz') {
      const tz = interaction.fields.getTextInputValue('timezone').trim();
      try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
      } catch {
        return interaction.editReply({ content: `❌ Múi giờ \`${tz}\` không hợp lệ.` });
      }
      await db.setGuildConfig(guildId, { ...cfg, timezone: tz });
      log.info('SETUP_CFG', guildId, 'Cập nhật timezone = %s', tz);
      return interaction.editReply({ content: `✅ Đã cập nhật Timezone thành \`${tz}\`.` });
    }

    if (modalId === MODAL_PREFIX + 'reminder') {
      const val = interaction.fields.getStringSelectValues('reminder_minutes')?.[0] ?? '10';
      const minutes = parseInt(val, 10) || 0;
      await db.setGuildConfig(guildId, {
        ...cfg,
        reminder_enabled: minutes > 0,
        reminder_minutes: minutes,
      });
      log.info('SETUP_CFG', guildId, 'Cập nhật reminder = %d phút', minutes);
      return interaction.editReply({ content: minutes > 0
        ? `✅ Đã bật nhắc nhở **${minutes} phút** trước giờ mở.`
        : '✅ Đã tắt nhắc nhở.' });
    }
  } catch (e) {
    log.error('SETUP_CFG', guildId, 'Lỗi cập nhật config: %s', e.message);
    return interaction.editReply({ content: '❌ Không thể cập nhật cấu hình, thử lại sau.' });
  }

  return interaction.editReply({ content: '❌ Hành động không xác định.' });
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
    return openEditModal(interaction);
  }
}

class SetupConfigEditModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId.startsWith(MODAL_PREFIX)) return this.some();
    return this.none();
  }

  run(interaction) {
    return handleEditModal(interaction);
  }
}

module.exports = {
  SetupConfigEditHandler,
  SetupConfigEditModalHandler,
};
