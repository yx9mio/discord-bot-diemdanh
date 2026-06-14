'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { setState, getState } = require('../../../utils/scheduleAddState.js');
const { renderAddViewStep1, renderAddViewStep2 } = require('../../../utils/scheduleAddViews.js');
const { wrapHandler } = require('../../../utils/error-boundary.js');
const { checkCooldown } = require('../../../utils/cooldown.js');

const HANDLED = ['setup:sch:add:r:day', 'setup:sch:add:r:hour', 'setup:sch:add:r:min',
  'setup:sch:add:r:close_day', 'setup:sch:add:r:close_hour', 'setup:sch:add:r:close_min',
  'setup:sch:add:r:channel'];

class SetupScheduleAddRecurringSelectHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.SelectMenu });
  }

  parse(interaction) {
    if (HANDLED.includes(interaction.customId)) return this.some();
    return this.none();
  }

  async run(interaction) {
    return wrapHandler(async (interaction) => {
    await interaction.deferUpdate();
    if (!checkCooldown(interaction.user.id, 'sch_add_select', 1000)) return interaction.editReply({ content: '⏳ Vui lòng đợi một chút...' });
    const { guild, customId, values } = interaction;
    const val = values[0];

    if (customId === 'setup:sch:add:r:day') setState(guild.id, interaction.user.id, { day: parseInt(val, 10) });
    else if (customId === 'setup:sch:add:r:hour') setState(guild.id, interaction.user.id, { hour: parseInt(val, 10) });
    else if (customId === 'setup:sch:add:r:min') setState(guild.id, interaction.user.id, { minute: parseInt(val, 10) });
    else if (customId === 'setup:sch:add:r:close_day') setState(guild.id, interaction.user.id, { closeDayOffset: val });
    else if (customId === 'setup:sch:add:r:close_hour') setState(guild.id, interaction.user.id, { closeHour: parseInt(val, 10) });
    else if (customId === 'setup:sch:add:r:close_min') setState(guild.id, interaction.user.id, { closeMinute: parseInt(val, 10) });
    else if (customId === 'setup:sch:add:r:channel') setState(guild.id, interaction.user.id, { channel: val });

    const state = getState(guild.id, interaction.user.id);
    const view = state.step === 2
      ? renderAddViewStep2(guild, state)
      : renderAddViewStep1(guild, state);
    return interaction.editReply(view);
  }, 'SetupScheduleAddRecurringSelectHandler')(interaction); }
}

module.exports = { SetupScheduleAddRecurringSelectHandler };
