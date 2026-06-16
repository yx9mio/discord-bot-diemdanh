'use strict';
// interaction-handlers/setup/setupConfigEditSelect.js
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const configService = require('../../../services/configService.js');
const log = require('../../../utils/logger.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { replyErrEdit } = require('../../../utils/embeds.js');
const { wrapHandler } = require('../../../utils/error-boundary.js');
const { auditLog } = require('../../../utils/auditLog.js');
const { checkCooldown } = require('../../../utils/cooldown.js');

const SELECT_PREFIX = 'setup:cfg:select:';

const SELECT_FIELD_MAP = {
  channel:          'notification_channel_id',
  admin_role:       'admin_role_id',
  attendance_role:  'attendance_role_id',
  phai:             'phai_role_ids',
};

const SELECT_FIELD_IS_ARRAY = new Set(['phai']);

class SetupConfigEditSelectHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.SelectMenu });
  }

  parse(interaction) {
    if (interaction.customId.startsWith(SELECT_PREFIX)) return this.some();
    return this.none();
  }

  async run(interaction) {
    return wrapHandler(async (interaction) => {
    await interaction.deferUpdate();
    const { ok } = await requireAdmin(interaction, { context: 'sửa cấu hình', deferred: true });
    if (!ok) return;
    if (!checkCooldown(interaction.user.id, 'setup_cfg_edit_select', 5000)) {
      return interaction.editReply({ content: '⏳ Vui lòng đợi một chút trước khi thực hiện hành động này.' });
    }
    const suffix = interaction.customId.slice(SELECT_PREFIX.length);
    const guildId = interaction.guild.id;
    const col = SELECT_FIELD_MAP[suffix];
    if (!col) return interaction.editReply(replyErrEdit(`Loại cài đặt không xác định: "${suffix}"`));

    const value = SELECT_FIELD_IS_ARRAY.has(suffix)
      ? interaction.values
      : interaction.values[0];
    try {
      await configService.setConfigField(guildId, col, value);
      auditLog({ guildId, actorId: interaction.user.id, action: 'CONFIG_UPDATE', metadata: { field: col, suffix } }).catch(() => {});
      const cfg = await configService.getGuildConfig(guildId);
      const { ConfigView } = require('../../commands/setup/_views/_ConfigView.js');
      ConfigView.storeMessageId(guildId, interaction.message.id);
      return interaction.editReply(ConfigView.render({ cfg, guild: interaction.guild }));
    } catch (e) {
      log.error('CFG_EDIT_SELECT', guildId, 'Lỗi lưu field %s: %s', suffix, e.message);
      return interaction.editReply(replyErrEdit(`Không thể lưu cài đặt: ${e.message}`));
    }
  }, 'SetupConfigEditSelectHandler')(interaction); }
}

module.exports = { SetupConfigEditSelectHandler };
