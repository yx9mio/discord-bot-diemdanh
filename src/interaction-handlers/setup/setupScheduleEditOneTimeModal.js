// src/interaction-handlers/setup/setupScheduleEditOneTimeModal.js
// Handles: setup:sch:edit:* (Button) — mở modal sửa lịch (recurring hoặc one-time)
'use strict';
const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const scheduledService = require('../../../services/scheduledService.js');
const log = require('../../../utils/logger.js');
const { DAY_NAMES: DAY_VI } = require('../../../utils/format.js');
const { requireAdmin } = require('../../../utils/permissions.js');

const EDIT_PREFIX = 'setup:sch:edit:';

function pad2(n) { return String(n).padStart(2, '0'); }

class SetupScheduleEditOneTimeModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (interaction.customId.startsWith(EDIT_PREFIX)) return this.some();
    return this.none();
  }

  async run(interaction) {
    const { ok } = await requireAdmin(interaction, { context: 'sửa lịch', deferred: false });
    if (!ok) return;

    const scheduleId = interaction.customId.slice(EDIT_PREFIX.length);
    const { guild } = interaction;

    try {
      const session = await scheduledService.getScheduledSessionById(scheduleId);
      if (!session) {
        return interaction.reply({ content: '❌ Không tìm thấy lịch.', flags: MessageFlags.Ephemeral });
      }

      const gioBatDau = pad2(session.hour) + ':' + pad2(session.minute);
      const gioKetThuc = session.close_hour != null && session.close_minute != null
        ? pad2(session.close_hour) + ':' + pad2(session.close_minute) : '';
      const ten = session.session_name ?? '';

      const isRecurring = session.type === 'recurring_weekly' || session.day_of_week != null;

      if (isRecurring) {
        const thuValue = DAY_VI[session.day_of_week] ?? String(session.day_of_week);
        const modal = new ModalBuilder()
          .setCustomId(`setup:sch:edit:recurring:${scheduleId}`)
          .setTitle('Sửa lịch định kỳ')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('day_of_week').setLabel('Thứ (2-8 hoặc mon,tue,cn)')
                .setStyle(TextInputStyle.Short).setRequired(true).setValue(thuValue),
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('gio_mo').setLabel('Giờ mở (HH:mm)')
                .setStyle(TextInputStyle.Short).setRequired(true).setValue(gioBatDau),
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('phut_bu').setLabel('Thời lượng (phút, 0 = không)')
                .setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('45'),
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('ten').setLabel('Tên phiên (tuỳ chọn)')
                .setStyle(TextInputStyle.Short).setRequired(false).setValue(ten),
            ),
          );
        return interaction.showModal(modal);
      }

      const ngay = session.scheduled_date ?? '';
      const modal = new ModalBuilder()
        .setCustomId(`setup:sch:edit:onetime:${scheduleId}`)
        .setTitle('Sửa lịch một lần')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('ngay').setLabel('Ngày (YYYY-MM-DD)')
              .setStyle(TextInputStyle.Short).setRequired(true).setValue(ngay),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('gio_mo').setLabel('Giờ mở (HH:mm)')
              .setStyle(TextInputStyle.Short).setRequired(true).setValue(gioBatDau),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('phut_bu').setLabel('Thời lượng (phút, 0 = không)')
              .setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('45'),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('ten').setLabel('Tên phiên (tuỳ chọn)')
              .setStyle(TextInputStyle.Short).setRequired(false).setValue(ten),
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
