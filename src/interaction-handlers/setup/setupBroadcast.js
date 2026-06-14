// src/interaction-handlers/setup/setupBroadcast.js
// Handles: setup:session:broadcast (Button) — mở modal phát tin
'use strict';
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { wrapHandler } = require('../../../utils/error-boundary.js');

const BROADCAST_MODAL_ID = 'setup:session:broadcast:modal';

class SetupBroadcastHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }
  parse(interaction) {
    if (interaction.customId === 'setup:session:broadcast') return this.some();
    return this.none();
  }
  run(interaction) {
    return wrapHandler(async (interaction) => {
    const modal = new ModalBuilder()
      .setCustomId(BROADCAST_MODAL_ID)
      .setTitle('📢 Phát tin')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('message').setLabel('Nội dung tin nhắn').setStyle(TextInputStyle.Paragraph)
            .setMaxLength(1900).setRequired(true).setPlaceholder('Nhập nội dung cần gửi...'),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('channel_id').setLabel('Kênh đích (Channel ID, để trống = kênh hiện tại)').setStyle(TextInputStyle.Short)
            .setRequired(false).setPlaceholder('Bỏ trống để gửi vào kênh này'),
        ),
      );
    return interaction.showModal(modal);
  }, 'SetupBroadcastHandler')(interaction); }
}

module.exports = { SetupBroadcastHandler };
