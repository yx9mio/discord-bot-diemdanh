'use strict';
// interaction-handlers/setup/setupConfigEditModal.js
// ModalSubmit handler: xử lý submit form chỉnh sửa cài đặt chung
// [FIX] Tách khỏi setupConfigEdit.js — Sapphire v3 chỉ load 1 class per file
// [FIX] run() phải return promise (async) để Sapphire handle lỗi đúng
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const db = require('../../db.js');
const log = require('../../utils/logger.js');
const { requireAdmin } = require('../../utils/permissions.js');

const MODAL_PREFIX = 'setup:cfg:modal:';

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
      if (!/^\d{17,20}$/.test(channelId)) {
        return interaction.editReply({ content: '❌ Channel ID không hợp lệ. Phải là dãy số 17-20 chữ số.' });
      }
      await db.setGuildConfig(guildId, { ...cfg, log_channel_id: channelId });
      log.info('SETUP_CFG', guildId, 'Cập nhật log_channel_id = %s', channelId);
      return interaction.editReply({ content: `✅ Đã cập nhật Kênh log thành <#${channelId}>.` });
    }

    if (modalId === MODAL_PREFIX + 'phai') {
      const raw = interaction.fields.getTextInputValue('role_ids').trim();
      const roleIds = raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : [];
      await db.setGuildConfig(guildId, { ...cfg, phai_role_ids: roleIds });
      log.info('SETUP_CFG', guildId, 'Cập nhật phai_role_ids = %j', roleIds);
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
      const minutes = parseInt(val, 10);
      if (isNaN(minutes) || minutes < 0) {
        return interaction.editReply({ content: '❌ Số phút không hợp lệ. Nhập số nguyên >= 0.' });
      }
      await db.setGuildConfig(guildId, {
        ...cfg,
        reminder_enabled: minutes > 0,
        reminder_minutes: minutes,
      });
      log.info('SETUP_CFG', guildId, 'Cập nhật reminder = %d phút', minutes);
      return interaction.editReply({
        content: minutes > 0
          ? `✅ Đã bật nhắc nhở **${minutes} phút** trước giờ mở.`
          : '✅ Đã tắt nhắc nhở.',
      });
    }

    if (modalId === MODAL_PREFIX + 'admin_role') {
      const raw = interaction.fields.getTextInputValue('role_id').trim();
      const roleId = raw || null;
      if (roleId && !/^\d{17,20}$/.test(roleId)) {
        return interaction.editReply({ content: '❌ Role ID không hợp lệ. Phải là dãy số 17-20 chữ số.' });
      }
      await db.setGuildConfig(guildId, { ...cfg, admin_role_id: roleId });
      log.info('SETUP_CFG', guildId, 'Cập nhật admin_role_id = %s', roleId);
      return interaction.editReply({
        content: roleId
          ? `✅ Đã cập nhật Role Quản lý thành <@&${roleId}>.`
          : '✅ Đã xoá Role Quản lý.',
      });
    }

    if (modalId === MODAL_PREFIX + 'attendance_role') {
      const raw = interaction.fields.getTextInputValue('role_id').trim();
      const roleId = raw || null;
      if (roleId && !/^\d{17,20}$/.test(roleId)) {
        return interaction.editReply({ content: '❌ Role ID không hợp lệ. Phải là dãy số 17-20 chữ số.' });
      }
      await db.setGuildConfig(guildId, { ...cfg, attendance_role_id: roleId });
      log.info('SETUP_CFG', guildId, 'Cập nhật attendance_role_id = %s', roleId);
      return interaction.editReply({
        content: roleId
          ? `✅ Đã cập nhật Role Điểm danh thành <@&${roleId}>.`
          : '✅ Đã xoá Role Điểm danh.',
      });
    }

    return interaction.editReply({ content: '❌ Hành động không xác định.' });
  } catch (e) {
    log.error('SETUP_CFG', guildId, 'Lỗi cập nhật config: %s', e.message);
    return interaction.editReply({ content: '❌ Không thể cập nhật cấu hình, thử lại sau.' });
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

  // [FIX] async run() để Sapphire bắt lỗi đúng và không để interaction timeout
  async run(interaction) {
    return handleEditModal(interaction);
  }
}

// [FIX] module.exports = Class (không phải object) — Sapphire v3 yêu cầu
module.exports = SetupConfigEditModalHandler;
