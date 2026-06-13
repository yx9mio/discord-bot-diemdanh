'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { setState, getState } = require('../../../utils/scheduleEditState.js');
const { renderEditViewStep1, renderEditViewStep2 } = require('../../../utils/scheduleEditViews.js');
const scheduledService = require('../../../services/scheduledService.js');
const log = require('../../../utils/logger.js');

const HANDLED = ['setup:sch:edit:r:day', 'setup:sch:edit:r:hour', 'setup:sch:edit:r:min',
  'setup:sch:edit:r:duration', 'setup:sch:edit:r:channel'];

class SetupScheduleEditRecurringSelectHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.SelectMenu });
  }

  parse(interaction) {
    if (HANDLED.includes(interaction.customId)) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferUpdate();
    const { guild, customId, values, message } = interaction;

    try {
      const val = values[0];

      let scheduleId = null;
      const footer = message?.embeds?.[0]?.footer?.text ?? '';
      const sidMatch = footer.match(/sid:(\d+)/);
      if (sidMatch) scheduleId = sidMatch[1];

      if (!scheduleId) {
        const schedules = await scheduledService.getScheduledSessions(guild.id).catch(() => []);
        const { ScheduleView } = require('../../commands/setup/_views/_ScheduleView.js');
        return interaction.editReply(ScheduleView.render({ schedules, guild, page: 0 }));
      }

      if (customId === 'setup:sch:edit:r:day') setState(guild.id, scheduleId, { day: parseInt(val, 10) });
      else if (customId === 'setup:sch:edit:r:hour') setState(guild.id, scheduleId, { hour: parseInt(val, 10) });
      else if (customId === 'setup:sch:edit:r:min') setState(guild.id, scheduleId, { minute: parseInt(val, 10) });
      else if (customId === 'setup:sch:edit:r:duration') setState(guild.id, scheduleId, { duration: parseInt(val, 10) });
      else if (customId === 'setup:sch:edit:r:channel') setState(guild.id, scheduleId, { channel: val });

      const state = getState(guild.id, scheduleId);
      const view = state?.step === 2
        ? renderEditViewStep2(guild, state)
        : renderEditViewStep1(guild, state);
      return interaction.editReply(view);
    } catch (e) {
      log.error('SCH_EDIT_SELECT', guild.id, 'edit select thất bại: %s', e.message);
      const schedules = await scheduledService.getScheduledSessions(guild.id).catch(() => []);
      const { ScheduleView } = require('../../commands/setup/_views/_ScheduleView.js');
      return interaction.editReply({ content: '❌ Lỗi xử lý, vui lòng thử lại.', ...ScheduleView.render({ schedules, guild, page: 0 }) });
    }
  }
}

module.exports = { SetupScheduleEditRecurringSelectHandler };
