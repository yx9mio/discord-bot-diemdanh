// src/interaction-handlers/setup/setupScheduleEditOneTimeModal.js
// Handles: setup:sch:edit:* (Button) — mở modal sửa lịch one-time
'use strict';
const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const scheduledService = require('../../services/scheduledService.js');
const configService    = require('../../services/configService.js');
const log = require('../../utils/logger.js');
const { CUSTOM_ID: SCH_CUSTOM_ID } = require('../../commands/setup/_views/_ScheduleView.js');
const { requireAdmin } = require('../../utils/permissions.js');

const EDIT_PREFIX = 'setup:sch:edit:';

class SetupScheduleEditOneTimeModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (interaction.customId.startsWith(EDIT_PREFIX)) return this.some();
    return this.none();
  }

  async run(interaction) {
    if (!requireAdmin(interaction)) {
      return interaction.reply({ content: '⛔ Chỉ admin mới dùng được.', flags: MessageFlags.Ephemeral });
    }

    const scheduleId = interaction.customId.slice(EDIT_PREFIX.length);
    const { guild } = interaction;

    try {
      const session = await scheduledService.getScheduledSession(guild.id, scheduleId);
      if (!session) {
        return interaction.reply({ content: '❌ Không tìm thấy lịch.', flags: MessageFlags.Ephemeral });
      }

      const modal = new ModalBuilder()
        .setCustomId(`setup:sch:edit:onetime:${scheduleId}`)
        .setTitle('Sửa lịch một lần')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('ngay')
              .setLabel('Ngày (YYYY-MM-DD)')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setValue(session.ngay ?? ''),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('gio_bat_dau')
              .setLabel('Giờ bắt đầu (HH:mm)')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setValue(session.gio_bat_dau ?? ''),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('gio_ket_thuc')
              .setLabel('Giờ kết thúc (HH:mm)')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setValue(session.gio_ket_thuc ?? ''),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('ten')
              .setLabel('Tên phiên (tuỳ chọn)')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setValue(session.ten ?? ''),
          ),
        );

      return interaction.showModal(modal);
    } catch (e) {
      log.error('SCH_EDIT_MODAL', guild.id, 'Lỗi mở modal sửa %s: %s', scheduleId, e.message);
      return interaction.reply({ content: `❌ Không thể mở form sửa: ${e.message}`, flags: MessageFlags.Ephemeral });
    }
  }
}

module.exports = { SetupScheduleEditOneTimeModalHandler };
