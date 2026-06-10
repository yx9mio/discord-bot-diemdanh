'use strict';
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
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { ok } = await requireAdmin(interaction, { context: 'sửa cấu hình', deferred: true });
    if (!ok) return;
    const field = interaction.customId.slice(MODAL_PREFIX.length);
    const value = interaction.fields.getTextInputValue('value').trim();
    const guildId = interaction.guild.id;

    try {
      await configService.setConfigField(guildId, field, value);
      const cfg = await configService.getGuildConfig(guildId);
      const { ConfigView } = require('../../commands/setup/_views/_ConfigView.js');
      await interaction.message?.edit(ConfigView.render({ cfg, guild: interaction.guild })).catch(() => null);
      return interaction.editReply({ content: '✅ Đã lưu cấu hình.' });
    } catch (e) {
      log.error('CFG_EDIT_MODAL', guildId, 'Lỗi lưu field %s: %s', field, e.message);
      return interaction.editReply({ content: `❌ Không thể lưu cấu hình: ${e.message}` });
    }
  }
}

module.exports = { SetupConfigEditModalHandler };
