'use strict';
// interaction-handlers/setup/setupConfigEditModal.js
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const configService = require('../../../services/configService.js');
const log = require('../../../utils/logger.js');
const { requireAdmin } = require('../../../utils/permissions.js');

const MODAL_PREFIX = 'setup:cfg:edit:modal:';

class SetupConfigEditModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId.startsWith(MODAL_PREFIX)) return this.some();
    return this.none();
  }

  async run(interaction) {
    if (!requireAdmin(interaction)) {
      return interaction.reply({ content: '⛔ Chỉ admin mới dùng được.', flags: MessageFlags.Ephemeral });
    }
    await interaction.deferUpdate();
    const field = interaction.customId.slice(MODAL_PREFIX.length);
    const value = interaction.fields.getTextInputValue('value').trim();
    const guildId = interaction.guild.id;

    try {
      await configService.setConfigField(guildId, field, value);
      const cfg = await configService.getGuildConfig(guildId);
      const { ConfigView } = require('../../commands/setup/_views/_ConfigView.js');
      return interaction.editReply(ConfigView.render(cfg));
    } catch (e) {
      log.error('CFG_EDIT_MODAL', guildId, 'Lỗi lưu field %s: %s', field, e.message);
      return interaction.editReply({ content: `❌ Không thể lưu cấu hình: ${e.message}` });
    }
  }
}

module.exports = { SetupConfigEditModalHandler };
