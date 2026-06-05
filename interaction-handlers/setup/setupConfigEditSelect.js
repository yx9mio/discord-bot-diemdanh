'use strict';
// interaction-handlers/setup/setupConfigEditSelect.js
// [FIX-DB] Thay db.js → configService
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const configService = require('../../services/configService.js');
const log = require('../../utils/logger.js');
const { requireAdmin } = require('../../utils/permissions.js');
const { ConfigView } = require('../../src/commands/setup/_views/_ConfigView.js'); // [FIX-SETUP]

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
  const cfg      = await configService.getGuildConfig(guildId);

  async function refreshView(newCfg) {
    const view = ConfigView.render({ cfg: newCfg, guild: interaction.guild });
    return interaction.editReply({ ...view, content: null });
  }

  try {
    if (selectId === SELECT_PREFIX + 'channel') {
      const channelId = interaction.values[0];
      const newCfg = { ...cfg, notification_channel_id: channelId };
      await configService.setGuildConfig(guildId, newCfg);
      log.info('SETUP_CFG', guildId, 'Cập nhật notification_channel_id = %s', channelId);
      return refreshView(newCfg);
    }

    if (selectId === SELECT_PREFIX + 'phai') {
      const roleIds = interaction.values;
      const newCfg = { ...cfg, phai_role_ids: roleIds };
      await configService.setGuildConfig(guildId, newCfg);
      log.info('SETUP_CFG', guildId, 'Cập nhật phai_role_ids = %j', roleIds);
      return refreshView(newCfg);
    }

    if (selectId === SELECT_PREFIX + 'admin_role') {
      const roleId = interaction.values[0] ?? null;
      const newCfg = { ...cfg, admin_role_id: roleId };
      await configService.setGuildConfig(guildId, newCfg);
      log.info('SETUP_CFG', guildId, 'Cập nhật admin_role_id = %s', roleId);
      return refreshView(newCfg);
    }

    if (selectId === SELECT_PREFIX + 'attendance_role') {
      const roleId = interaction.values[0] ?? null;
      const newCfg = { ...cfg, attendance_role_id: roleId };
      await configService.setGuildConfig(guildId, newCfg);
      log.info('SETUP_CFG', guildId, 'Cập nhật attendance_role_id = %s', roleId);
      return refreshView(newCfg);
    }

    return interaction.editReply({ content: '❌ Hành động không xác định.', components: [] });
  } catch (e) {
    log.error('SETUP_CFG', guildId, 'Lỗi cập nhật config qua select: %s', e.message);
    return interaction.editReply({ content: `❌ Không thể cập nhật: ${e.message}`, components: [] });
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
