'use strict';
// interaction-handlers/setup/setupConfigEditSelect.js
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const configService = require('../../../services/configService.js');
const log = require('../../../utils/logger.js');
const { requireAdmin } = require('../../../utils/permissions.js');

const SELECT_PREFIX = 'setup:cfg:edit:select:';

class SetupConfigEditSelectHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.SelectMenu });
  }

  parse(interaction) {
    if (interaction.customId.startsWith(SELECT_PREFIX)) return this.some();
    return this.none();
  }

  async run(interaction) {
    const { ok } = await requireAdmin(interaction, { context: 'sửa cấu hình', deferred: false });
    if (!ok) return;
    await interaction.deferUpdate();
    const field = interaction.customId.slice(SELECT_PREFIX.length);
    const value = interaction.values[0];
    const guildId = interaction.guild.id;

    try {
      await configService.setConfigField(guildId, field, value);
      const cfg = await configService.getGuildConfig(guildId);
      const { ConfigView } = require('../../commands/setup/_views/_ConfigView.js');
      return interaction.editReply(ConfigView.render(cfg));
    } catch (e) {
      log.error('CFG_EDIT_SELECT', guildId, 'Lỗi lưu field %s: %s', field, e.message);
      return interaction.editReply({ content: `❌ Không thể lưu cấu hình: ${e.message}` });
    }
  }
}

module.exports = { SetupConfigEditSelectHandler };
