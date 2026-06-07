// src/interaction-handlers/setup/setupScheduleAddTypeModal.js
// Handles: setup:sch:add (Button) — mở Modal bước 1 chọn loại lịch
'use strict';
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { requireAdmin } = require('../../../../utils/permissions.js');

const CUSTOM_ID = {
  ADD: 'setup:sch:add',
  TYPE_MODAL: 'setup:sch:add:type',
};

class SetupScheduleAddTypeModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (interaction.customId === CUSTOM_ID.ADD) return this.some();
    return this.none();
  }

  async run(interaction) {
    if (!requireAdmin(interaction)) {
      const { MessageFlags } = require('discord.js');
      return interaction.reply({ content: '⛔ Chỉ admin mới dùng được.', flags: MessageFlags.Ephemeral });
    }

    const modal = new ModalBuilder()
      .setCustomId(CUSTOM_ID.TYPE_MODAL)
      .setTitle('Thêm lịch — Bước 1: Chọn loại')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('loai')
            .setLabel('Loại lịch (recurring / onetime)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('recurring hoặc onetime'),
        ),
      );
    return interaction.showModal(modal);
  }
}

module.exports = { SetupScheduleAddTypeModalHandler, CUSTOM_ID };
