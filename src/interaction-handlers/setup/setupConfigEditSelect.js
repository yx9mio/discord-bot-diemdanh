'use strict';
// interaction-handlers/setup/setupConfigEditSelect.js
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { MessageFlags } = require('discord.js');
const configService = require('../../../services/configService.js');
const log = require('../../../utils/logger.js');
const { requireAdmin } = require('../../../utils/permissions.js');

const SELECT_CHANNEL        = 'setup:cfg:select:channel';
const SELECT_PHAI           = 'setup:cfg:select:phai';
const SELECT_ADMIN_ROLE     = 'setup:cfg:select:admin_role';
const SELECT_ATTENDANCE_ROLE = 'setup:cfg:select:attendance_role';

const HANDLED_SELECTS = new Set([
  SELECT_CHANNEL, SELECT_PHAI, SELECT_ADMIN_ROLE, SELECT_ATTENDANCE_ROLE,
]);

class SetupConfigEditSelectHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.SelectMenus });
  }

  parse(interaction) {
    if (HANDLED_SELECTS.has(interaction.customId)) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { ok } = await requireAdmin(interaction, { context: 'cài đặt', deferred: true });
    if (!ok) return;

    const { customId, guild } = interaction;

    if (customId === SELECT_CHANNEL) {
      const channelId = interaction.values[0];
      try {
        await configService.upsertGuildConfig(guild.id, { notification_channel_id: channelId });
        log.info('CFG_EDIT', guild.id, 'notification_channel_id → %s', channelId);
        return interaction.editReply({ content: `✅ Đã cập nhật kênh thông báo: <#${channelId}>` });
      } catch (e) {
        log.error('CFG_EDIT', guild.id, 'upsert channel thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể lưu cài đặt, thử lại sau.' });
      }
    }

    if (customId === SELECT_PHAI) {
      const roleIds = interaction.values;
      try {
        await configService.upsertGuildConfig(guild.id, { phai_role_ids: roleIds });
        log.info('CFG_EDIT', guild.id, 'phai_role_ids → %j', roleIds);
        const msg = roleIds.length
          ? `✅ Đã cập nhật các role phái: ${roleIds.map(r => `<@&${r}>`).join(', ')}`
          : '✅ Đã xoá tất cả role phái.';
        return interaction.editReply({ content: msg });
      } catch (e) {
        log.error('CFG_EDIT', guild.id, 'upsert phai_role_ids thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể lưu cài đặt, thử lại sau.' });
      }
    }

    if (customId === SELECT_ADMIN_ROLE) {
      const roleId = interaction.values[0] ?? null;
      try {
        await configService.upsertGuildConfig(guild.id, { admin_role_id: roleId });
        log.info('CFG_EDIT', guild.id, 'admin_role_id → %s', roleId);
        const msg = roleId
          ? `✅ Đã cập nhật role quản lý: <@&${roleId}>`
          : '✅ Đã xoá role quản lý.';
        return interaction.editReply({ content: msg });
      } catch (e) {
        log.error('CFG_EDIT', guild.id, 'upsert admin_role_id thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể lưu cài đặt, thử lại sau.' });
      }
    }

    if (customId === SELECT_ATTENDANCE_ROLE) {
      const roleId = interaction.values[0] ?? null;
      try {
        await configService.upsertGuildConfig(guild.id, { attendance_role_id: roleId });
        log.info('CFG_EDIT', guild.id, 'attendance_role_id → %s', roleId);
        const msg = roleId
          ? `✅ Đã cập nhật role điểm danh: <@&${roleId}>`
          : '✅ Đã xoá role điểm danh.';
        return interaction.editReply({ content: msg });
      } catch (e) {
        log.error('CFG_EDIT', guild.id, 'upsert attendance_role_id thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể lưu cài đặt, thử lại sau.' });
      }
    }
  }
}

module.exports = { SetupConfigEditSelectHandler };
