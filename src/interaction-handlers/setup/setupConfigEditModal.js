'use strict';
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const configService = require('../../../services/configService.js');
const log = require('../../../utils/logger.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { replyErrEdit } = require('../../../utils/embeds.js');

const MODAL_PREFIX = 'setup:cfg:modal:';

const FIELD_MAP = {
  tz:        { col: 'timezone', inputId: 'timezone' },
  phai_icon: { col: 'phai_role_icons', inputId: null },
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

    let value;
    if (suffix === 'phai_icon') {
      const icons = {};
      for (const [customId, field] of interaction.fields.fields) {
        if (!customId.startsWith('phai_icon:')) continue;
        const roleId = customId.slice('phai_icon:'.length);
        const emoji = field.value.trim();
        if (emoji) icons[roleId] = emoji;
      }
      value = icons;
    } else {
      value = interaction.fields.getTextInputValue(mapping.inputId).trim();
      if (!value) return interaction.editReply(replyErrEdit('Giá trị không được để trống.'));
    }

    try {
      await configService.setConfigField(guildId, mapping.col, value);
      const cfg = await configService.getGuildConfig(guildId);
      const { ConfigView } = require('../../commands/setup/_views/_ConfigView.js');
      const msgId = ConfigView.getMessageId(guildId);
      if (msgId) {
        const ch = interaction.channel;
        const msg = await ch.messages.fetch(msgId).catch(() => null);
        if (msg) await msg.edit(ConfigView.render({ cfg, guild: interaction.guild })).catch(() => null);
      }
      return interaction.editReply({ content: '✅ Đã lưu cấu hình.' });
    } catch (e) {
      log.error('CFG_EDIT_MODAL', guildId, 'Lỗi lưu field %s: %s', suffix, e.message);
      return interaction.editReply(replyErrEdit(`Không thể lưu cấu hình: ${e.message}`));
    }
  }
}

module.exports = { SetupConfigEditModalHandler };
