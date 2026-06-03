'use strict';
// interaction-handlers/setup/setupConfigEditSelect.js
// SelectMenu handler: xử lý ChannelSelect & RoleSelect cho cài đặt chung
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const db  = require('../../db.js');
const log = require('../../utils/logger.js');
const { requireAdmin } = require('../../utils/permissions.js');

const SELECT_PREFIX = 'setup:cfg:select:';

const SELECT_IDS = new Set([
  SELECT_PREFIX + 'channel',
  SELECT_PREFIX + 'phai',
  SELECT_PREFIX + 'admin_role',
  SELECT_PREFIX + 'attendance_role',
]);

async function handleSelect(interaction) {
  await interaction.deferUpdate();

  const { ok } = await requireAdmin(interaction, { context: 'chỉnh sửa cấu hình', deferred: true });
  if (!ok) return;

  const guildId  = interaction.guildId;
  const selectId = interaction.customId;
  const cfg      = await db.getGuildConfig(guildId);

  try {
    // --- Kênh log ---
    if (selectId === SELECT_PREFIX + 'channel') {
      const channelId = interaction.values[0];
      await db.setGuildConfig(guildId, { ...cfg, log_channel_id: channelId });
      log.info('SETUP_CFG', guildId, 'Cập nhật log_channel_id = %s', channelId);
      return interaction.editReply({
        content: `✅ Đã cập nhật kênh log thành <#${channelId}>.`,
        components: [],
      });
    }

    // --- Phái (multi-role) ---
    if (selectId === SELECT_PREFIX + 'phai') {
      const roleIds = interaction.values; // [] nếu bỏ trống
      await db.setGuildConfig(guildId, { ...cfg, phai_role_ids: roleIds });
      log.info('SETUP_CFG', guildId, 'Cập nhật phai_role_ids = %j', roleIds);
      const label = roleIds.length > 0
        ? roleIds.map(id => `<@&${id}>`).join(', ')
        : '*(không có)*';
      return interaction.editReply({
        content: `✅ Đã cập nhật Phái: ${label}`,
        components: [],
      });
    }

    // --- Role Quản lý ---
    if (selectId === SELECT_PREFIX + 'admin_role') {
      const roleId = interaction.values[0] ?? null;
      await db.setGuildConfig(guildId, { ...cfg, admin_role_id: roleId });
      log.info('SETUP_CFG', guildId, 'Cập nhật admin_role_id = %s', roleId);
      return interaction.editReply({
        content: roleId
          ? `✅ Đã cập nhật Role Quản lý thành <@&${roleId}>.`
          : '✅ Đã xoá Role Quản lý.',
        components: [],
      });
    }

    // --- Role Điểm danh ---
    if (selectId === SELECT_PREFIX + 'attendance_role') {
      const roleId = interaction.values[0] ?? null;
      await db.setGuildConfig(guildId, { ...cfg, attendance_role_id: roleId });
      log.info('SETUP_CFG', guildId, 'Cập nhật attendance_role_id = %s', roleId);
      return interaction.editReply({
        content: roleId
          ? `✅ Đã cập nhật Role Điểm danh thành <@&${roleId}>.`
          : '✅ Đã xoá Role Điểm danh.',
        components: [],
      });
    }

    return interaction.editReply({ content: '❌ Hành động không xác định.', components: [] });
  } catch (e) {
    log.error('SETUP_CFG', guildId, 'Lỗi cập nhật config qua select: %s', e.message);
    return interaction.editReply({ content: '❌ Không thể cập nhật, thử lại sau.', components: [] });
  }
}

class SetupConfigEditSelectHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.SelectMenu,
    });
  }

  parse(interaction) {
    if (SELECT_IDS.has(interaction.customId)) return this.some();
    return this.none();
  }

  async run(interaction) {
    return handleSelect(interaction);
  }
}

module.exports = SetupConfigEditSelectHandler;
