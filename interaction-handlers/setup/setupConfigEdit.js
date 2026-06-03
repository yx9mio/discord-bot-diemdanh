'use strict';
const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const db = require('../../db.js');
const log = require('../../utils/logger.js');
const { requireAdmin } = require('../../utils/permissions.js');

const EDIT_CHANNEL       = 'setup:cfg:edit:channel';
const EDIT_PHAI          = 'setup:cfg:edit:phai';
const EDIT_TZ            = 'setup:cfg:edit:tz';
const EDIT_REMINDER      = 'setup:cfg:edit:reminder';
const EDIT_ADMIN_ROLE    = 'setup:cfg:edit:admin_role';
const EDIT_ATTENDANCE_ROLE = 'setup:cfg:edit:attendance_role';

const EDIT_IDS = new Set([EDIT_CHANNEL, EDIT_PHAI, EDIT_TZ, EDIT_REMINDER, EDIT_ADMIN_ROLE, EDIT_ATTENDANCE_ROLE]);
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

  if (!modal) return interaction.reply({ content: '❌ Hành động không xác định.', flags: MessageFlags.Ephemeral });
  return interaction.showModal(modal);
}

async function handleEditModal(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const { ok } = await requireAdmin(interaction, { context: 'chỉnh sửa cấu hình', deferred: true });
  if (!ok) return;

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
      const val = (interaction.fields.getTextInputValue('reminder_minutes') || '').trim();
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

    if (modalId === MODAL_PREFIX + 'admin_role') {
      const raw = interaction.fields.getTextInputValue('role_id').trim();
      const roleId = raw || null;
      await db.setGuildConfig(guildId, { ...cfg, admin_role_id: roleId });
      log.info('SETUP_CFG', guildId, 'Cập nhật admin_role_id = %s', roleId);
      return interaction.editReply({ content: roleId
        ? `✅ Đã cập nhật Role Quản lý thành <@&${roleId}>.`
        : '✅ Đã xoá Role Quản lý.' });
    }

    if (modalId === MODAL_PREFIX + 'attendance_role') {
      const raw = interaction.fields.getTextInputValue('role_id').trim();
      const roleId = raw || null;
      await db.setGuildConfig(guildId, { ...cfg, attendance_role_id: roleId });
      log.info('SETUP_CFG', guildId, 'Cập nhật attendance_role_id = %s', roleId);
      return interaction.editReply({ content: roleId
        ? `✅ Đã cập nhật Role Điểm danh thành <@&${roleId}>.`
        : '✅ Đã xoá Role Điểm danh.' });
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
