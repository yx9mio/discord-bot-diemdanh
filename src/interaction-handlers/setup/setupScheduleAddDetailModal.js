// src/interaction-handlers/setup/setupScheduleAddDetailModal.js
// Handles: setup:sch:add:recurring:detail + setup:sch:add:onetime:detail (ModalSubmit)
// [BUG-FIX] One-time modal đọc field 'ngay' (không phải 'ngay_gio')
// [FIX-PATH] ../../../ → ../../../../
'use strict';
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const scheduledService = require('../../../services/scheduledService.js');
const configService    = require('../../../services/configService.js');
const log = require('../../../utils/logger.js');
const { CUSTOM_ID } = require('./setupScheduleAddTypeModal.js');
const { requireAdmin } = require('../../../utils/permissions.js');

const MODAL_RECURRING_ID = 'setup:sch:add:recurring:detail';
const MODAL_ONETIME_ID   = 'setup:sch:add:onetime:detail';

class SetupScheduleAddDetailModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId === MODAL_RECURRING_ID || interaction.customId === MODAL_ONETIME_ID) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferUpdate();
    const { ok } = await requireAdmin(interaction, { deferred: true, context: 'thêm lịch' });
    if (!ok) return;
    const { guild, customId } = interaction;

    try {
      const cfg = await configService.getGuildConfig(guild.id);
      const tz = cfg?.timezone ?? 'Asia/Ho_Chi_Minh';

      if (customId === MODAL_RECURRING_ID) {
        const thu        = interaction.fields.getTextInputValue('thu').trim();
        const gio_bat_dau = interaction.fields.getTextInputValue('gio_bat_dau').trim();
        const gio_ket_thuc = interaction.fields.getTextInputValue('gio_ket_thuc').trim();
        const ten        = interaction.fields.getTextInputValue('ten')?.trim() ?? '';

        await scheduledService.addRecurringSession(guild.id, {
          thu, gio_bat_dau, gio_ket_thuc, ten, timezone: tz,
        });
      } else {
        // MODAL_ONETIME_ID
        const ngay       = interaction.fields.getTextInputValue('ngay').trim();
        const gio_bat_dau = interaction.fields.getTextInputValue('gio_bat_dau').trim();
        const gio_ket_thuc = interaction.fields.getTextInputValue('gio_ket_thuc').trim();
        const ten        = interaction.fields.getTextInputValue('ten')?.trim() ?? '';

        await scheduledService.addOnetimeSession(guild.id, {
          ngay, gio_bat_dau, gio_ket_thuc, ten, timezone: tz,
        });
      }

      const { ScheduleView } = require('../../commands/setup/_views/_ScheduleView.js');
      const sessions = await scheduledService.getScheduledSessions(guild.id);
      return interaction.editReply(ScheduleView.render({ schedules: sessions, guild, page: 0 }));
    } catch (e) {
      log.error('SCH_ADD_DETAIL', guild.id, 'Lỗi thêm lịch: %s', e.message);
      return interaction.editReply({ content: `❌ Không thể thêm lịch: ${e.message}` });
    }
  }
}

module.exports = { SetupScheduleAddDetailModalHandler, MODAL_RECURRING_ID, MODAL_ONETIME_ID };
