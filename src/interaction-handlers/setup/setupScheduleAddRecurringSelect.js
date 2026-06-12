'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { setState, getState } = require('../../../utils/scheduleAddState.js');
const { renderAddViewStep1, renderAddViewStep2 } = require('../../../utils/scheduleAddViews.js');

const HANDLED = ['setup:sch:add:r:day', 'setup:sch:add:r:hour', 'setup:sch:add:r:min',
  'setup:sch:add:r:duration', 'setup:sch:add:r:channel'];

class SetupScheduleAddRecurringSelectHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.SelectMenu });
  }

  parse(interaction) {
    if (HANDLED.includes(interaction.customId)) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferUpdate();
    const { guild, customId, values } = interaction;
    const val = values[0];

    if (customId === 'setup:sch:add:r:day') setState(guild.id, { day: parseInt(val, 10) });
    else if (customId === 'setup:sch:add:r:hour') setState(guild.id, { hour: parseInt(val, 10) });
    else if (customId === 'setup:sch:add:r:min') setState(guild.id, { minute: parseInt(val, 10) });
    else if (customId === 'setup:sch:add:r:duration') setState(guild.id, { duration: parseInt(val, 10) });
    else if (customId === 'setup:sch:add:r:channel') setState(guild.id, { channel: val });

    const state = getState(guild.id);
    const view = state.step === 2
      ? renderAddViewStep2(guild, state)
      : renderAddViewStep1(guild, state);
    return interaction.editReply(view);
  }
}

module.exports = { SetupScheduleAddRecurringSelectHandler };
