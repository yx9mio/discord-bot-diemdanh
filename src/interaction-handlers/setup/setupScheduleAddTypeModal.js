// src/interaction-handlers/setup/setupScheduleAddTypeModal.js
// Handles: setup:sch:add (Button) — mở Modal bước 1 chọn loại lịch
'use strict';
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');

const CUSTOM_ID = Object.freeze({
  ADD_BTN:             'setup:sch:add',
  EDIT_BTN_PREFIX:     'setup:sch:edit:',
  TYPE_MODAL:          'setup:sch:add:type',
  RECURRING_MODAL:     'setup:sch:add:recurring:detail',
  ONETIME_MODAL:       'setup:sch:add:onetime:detail',
  EDIT_ONETIME_PREFIX: 'setup:sch:edit:onetime:',
  PAGE_NEXT:           'setup:sch:next',
  PAGE_PREV:           'setup:sch:prev',
  REFRESH:             'setup:sch:refresh',
  DEL_PREFIX:          'setup:sch:del:',
  DEL_CONFIRM:         'setup:sch:del:confirm:',
  DEL_CANCEL:          'setup:sch:del:cancel:',
});

class SetupScheduleAddBtnHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }
  parse(interaction) {
    if (interaction.customId === CUSTOM_ID.ADD_BTN) return this.some();
    return this.none();
  }
  run(interaction) {
    const modal = new ModalBuilder()
      .setCustomId(CUSTOM_ID.TYPE_MODAL)
      .setTitle('Thêm lịch tự động — Bước 1/2')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('loai')
            .setLabel('Loại lịch: "week" (hàng tuần) hoặc "once" (1 lần)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('week / once')
            .setRequired(true),
        ),
      );
    return interaction.showModal(modal);
  }
}

module.exports = { SetupScheduleAddBtnHandler, CUSTOM_ID };
