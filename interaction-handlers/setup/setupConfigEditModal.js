'use strict';
// interaction-handlers/setup/setupConfigEditModal.js
// ModalSubmit handler: xử lý submit form timezone & reminder
// [FIX-DB] Thay db.js → configService
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const configService = require('../../services/configService.js');
const log = require('../../utils/logger.js');
const { requireAdmin } = require('../../utils/permissions.js');

const MODAL_PREFIX = 'setup:cfg:modal:';

async function handleEditModal(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const { ok } = await requireAdmin(interaction, { context: 'chỉnh sửa cấu hình', deferred: true });
  if (!ok) return;

  const guildId = interaction.guildId;
  const modalId = interaction.customId;
  const cfg     = await configService.getGuildConfig(guildId);

  try {
    if (modalId === MODAL_PREFIX + 'tz') {
      const tz = interaction.fields.getTextInputValue('timezone').trim();
      try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
      } catch {
        return interaction.editReply({ content: `❌ Múi giờ \`${tz}\` không hợp lệ.` });
      }
      const newCfg = { ...cfg, timezone: tz };
      await configService.setGuildConfig(guildId, newCfg);
      log.info('SETUP_CFG', guildId, 'Cập nhật timezone = %s', tz);
      return interaction.editReply({
        content: `✅ Đã cập nhật Timezone thành \`${tz}\`.\n> 🔄 Bấm **Cài đặt chung** để xem bảng cấu hình đã cập nhật.`,
      });
    }

    if (modalId === MODAL_PREFIX + 'reminder') {
      const val     = (interaction.fields.getTextInputValue('reminder_minutes') || '').trim();
      const minutes = parseInt(val, 10);
      if (isNaN(minutes) || minutes < 0) {
        return interaction.editReply({ content: '❌ Số phút không hợp lệ. Nhập số nguyên >= 0.' });
      }
      const newCfg = {
        ...cfg,
        reminder_enabled: minutes > 0,
        reminder_minutes: minutes,
      };
      await configService.setGuildConfig(guildId, newCfg);
      log.info('SETUP_CFG', guildId, 'Cập nhật reminder = %d phút', minutes);
      return interaction.editReply({
        content: (minutes > 0
          ? `✅ Đã bật nhắc nhở **${minutes} phút** trước giờ mở.`
          : '✅ Đã tắt nhắc nhở.')
          + '\n> 🔄 Bấm **Cài đặt chung** để xem bảng cấu hình đã cập nhật.',
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

  async run(interaction) {
    return handleEditModal(interaction);
  }
}

module.exports = SetupConfigEditModalHandler;
