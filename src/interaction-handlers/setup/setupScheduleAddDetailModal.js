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

const MODAL_RECURRING = 'setup:sch:add:recurring:detail';
const MODAL_ONETIME   = 'setup:sch:add:onetime:detail';

class SetupScheduleAddDetailModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId === MODAL_RECURRING || interaction.customId === MODAL_ONETIME) return this.some();
    return this.none();
  }

  async run(interaction) {
    if (!requireAdmin(interaction)) {
      return interaction.reply({ content: '⛔ Chỉ admin mới dùng được.', flags: MessageFlags.Ephemeral });
    }
    await interaction.deferUpdate();
    const { guild, customId } = interaction;

    try {
      const cfg = await configService.getGuildConfig(guild.id);
      const tz = cfg?.timezone ?? 'Asia/Ho_Chi_Minh';

      if (customId === MODAL_RECURRING) {
        const thu        = interaction.fields.getTextInputValue('thu').trim();
        const gio_bat_dau = interaction.fields.getTextInputValue('gio_bat_dau').trim();
        const gio_ket_thuc = interaction.fields.getTextInputValue('gio_ket_thuc').trim();
        const ten        = interaction.fields.getTextInputValue('ten')?.trim() ?? '';

        await scheduledService.addRecurringSession(guild.id, {
          thu, gio_bat_dau, gio_ket_thuc, ten, timezone: tz,
        });
      } else {
        // MODAL_ONETIME
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
      return interaction.editReply(ScheduleView.render(sessions));
    } catch (e) {
      log.error('SCH_ADD_DETAIL', guild.id, 'Lỗi thêm lịch: %s', e.message);
      return interaction.editReply({ content: `❌ Không thể thêm lịch: ${e.message}` });
    }
  }
}

module.exports = { SetupScheduleAddDetailModalHandler };
