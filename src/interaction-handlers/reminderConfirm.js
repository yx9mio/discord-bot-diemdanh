'use strict';
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');

class ReminderConfirmHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (interaction.customId?.startsWith('reminder:confirm:')) return this.some();
    return this.none();
  }

  async run(interaction) {
    const schedId = interaction.customId.slice('reminder:confirm:'.length);
    return interaction.reply({
      content: `✅ Đã ghi nhận! Bạn sẽ được nhắc khi phiên bắt đầu.`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

module.exports = { ReminderConfirmHandler };
