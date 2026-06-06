'use strict';
// interaction-handlers/setup/setupConfigEditModal.js
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const configService = require('../../../services/configService.js');
const log = require('../../../utils/logger.js');
const { requireAdmin } = require('../../../utils/permissions.js');

const MODAL_TZ       = 'setup:cfg:modal:tz';
const MODAL_REMINDER = 'setup:cfg:modal:reminder';
const HANDLED_MODALS = new Set([MODAL_TZ, MODAL_REMINDER]);

class SetupConfigEditModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (HANDLED_MODALS.has(interaction.customId)) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { ok } = await requireAdmin(interaction, { context: 'cài đặt', deferred: true });
    if (!ok) return;

    const { customId, guild } = interaction;

    if (customId === MODAL_TZ) {
      const tz = interaction.fields.getTextInputValue('timezone').trim();
      try {
        // Validate timezone
        Intl.DateTimeFormat(undefined, { timeZone: tz });
      } catch {
        return interaction.editReply({ content: `❌ Timezone không hợp lệ: \`${tz}\`` });
      }
      try {
        await configService.upsertGuildConfig(guild.id, { timezone: tz });
        log.info('CFG_EDIT', guild.id, 'Timezone → %s', tz);
        return interaction.editReply({ content: `✅ Đã cập nhật timezone: \`${tz}\`` });
      } catch (e) {
        log.error('CFG_EDIT', guild.id, 'upsert timezone thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể lưu timezone, thử lại sau.' });
      }
    }

    if (customId === MODAL_REMINDER) {
      const raw = interaction.fields.getTextInputValue('reminder_minutes').trim();
      const mins = parseInt(raw, 10);
      if (isNaN(mins) || mins < 0 || mins > 1440) {
        return interaction.editReply({ content: '❌ Vui lòng nhập số phút hợp lệ (0–1440).' });
      }
      try {
        await configService.upsertGuildConfig(guild.id, { reminder_minutes: mins });
        log.info('CFG_EDIT', guild.id, 'Reminder → %d phút', mins);
        const msg = mins === 0
          ? '✅ Đã tắt nhắc nhở.'
          : `✅ Đã cập nhật nhắc nhở: **${mins} phút** trước giờ mở phiên.`;
        return interaction.editReply({ content: msg });
      } catch (e) {
        log.error('CFG_EDIT', guild.id, 'upsert reminder thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể lưu cài đặt, thử lại sau.' });
      }
    }
  }
}

module.exports = { SetupConfigEditModalHandler };
