'use strict';
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const configService = require('../../../services/configService.js');
const log = require('../../../utils/logger.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { replyErrEdit } = require('../../../utils/embeds.js');

const MODAL_PREFIX = 'setup:cfg:modal:';

const FIELD_MAP = {
  tz: { col: 'timezone', inputId: 'timezone' },
};

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
    const suffix = interaction.customId.slice(MODAL_PREFIX.length);
    const guildId = interaction.guild.id;
    const mapping = FIELD_MAP[suffix];
    if (!mapping) return interaction.editReply(replyErrEdit(`Loại cấu hình không xác định: "${suffix}"`));

    const value = interaction.fields.getTextInputValue(mapping.inputId).trim();
    if (!value) return interaction.editReply(replyErrEdit('Giá trị không được để trống.'));

    try {
      await configService.setConfigField(guildId, mapping.col, value);
      const cfg = await configService.getGuildConfig(guildId);
      const { ConfigView } = require('../../commands/setup/_views/_ConfigView.js');
      await interaction.message?.edit(ConfigView.render({ cfg, guild: interaction.guild })).catch(() => null);
      return interaction.editReply({ content: '✅ Đã lưu cấu hình.' });
    } catch (e) {
      log.error('CFG_EDIT_MODAL', guildId, 'Lỗi lưu field %s: %s', suffix, e.message);
      return interaction.editReply(replyErrEdit(`Không thể lưu cấu hình: ${e.message}`));
    }
  }
}

module.exports = { SetupConfigEditModalHandler };
