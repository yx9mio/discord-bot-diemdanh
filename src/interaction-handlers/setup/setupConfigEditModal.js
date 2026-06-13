'use strict';
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { DateTime } = require('luxon');
const configService = require('../../../services/configService.js');
const log = require('../../../utils/logger.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { replyErrEdit } = require('../../../utils/embeds.js');

const MODAL_PREFIX = 'setup:cfg:modal:';

const FIELD_MAP = {
  tz: { col: 'timezone', inputId: 'timezone' },
};

async function _refreshConfigAndReply(interaction, guildId) {
  const cfg = await configService.getGuildConfig(guildId);
  const { ConfigView } = require('../../commands/setup/_views/_ConfigView.js');
  const msgId = ConfigView.getMessageId(guildId);
  if (msgId) {
    const ch = interaction.channel;
    const msg = await ch.messages.fetch(msgId).catch(() => null);
    if (msg) await msg.edit(ConfigView.render({ cfg, guild: interaction.guild })).catch(() => null);
  }
  return interaction.editReply({ content: '✅ Đã lưu cấu hình.' });
}

class SetupConfigEditModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId?.startsWith(MODAL_PREFIX)) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { ok } = await requireAdmin(interaction, { context: 'sửa cấu hình', deferred: true });
    if (!ok) return;
    const suffix = interaction.customId.slice(MODAL_PREFIX.length);
    const guildId = interaction.guild.id;

    if (suffix === 'emoji_name') {
      const cfg = await configService.getGuildConfig(guildId);
      const phaiIds = cfg?.phai_role_ids ?? [];
      const existing = cfg?.phai_role_icons ?? {};
      const raw = interaction.fields?.getTextInputValue('emoji_names') ?? '';
      // Parse mỗi dòng: RoleName=EmojiName
      const lines = raw.split('\n').filter(Boolean);
      for (const line of lines) {
        const sep = line.indexOf('=');
        if (sep <= 0) continue;
        const roleName = line.slice(0, sep).trim();
        const emojiName = line.slice(sep + 1).trim();
        if (!roleName) continue;
        // Tìm roleId theo tên role
        const role = interaction.guild.roles.cache.find(r => r.name === roleName);
        if (!role) continue;
        if (emojiName) existing[role.id] = emojiName;
        else delete existing[role.id];
      }
      // Xoá các entry của phái không còn trong danh sách
      for (const key of Object.keys(existing)) {
        if (!phaiIds.includes(key)) delete existing[key];
      }
      try {
        await configService.setConfigField(guildId, 'phai_role_icons', existing);
        return await _refreshConfigAndReply(interaction, guildId);
      } catch (e) {
        log.error('CFG_EDIT_MODAL', guildId, 'Lỗi lưu emoji_name: %s', e.message);
        return interaction.editReply(replyErrEdit(`Không thể lưu: ${e.message}`));
      }
    }

    const mapping = FIELD_MAP[suffix];
    if (!mapping) return interaction.editReply(replyErrEdit(`Loại cấu hình không xác định: "${suffix}"`));

    const value = interaction.fields.getTextInputValue(mapping.inputId).trim();
    if (!value) return interaction.editReply(replyErrEdit('Giá trị không được để trống.'));
    if (suffix === 'tz') {
      if (!DateTime.now().setZone(value).isValid) {
        return interaction.editReply(replyErrEdit(`Múi giờ không hợp lệ: "${value}". Gợi ý: Asia/Ho_Chi_Minh, Asia/Saigon, UTC...`));
      }
    }

    try {
      await configService.setConfigField(guildId, mapping.col, value);
      return await _refreshConfigAndReply(interaction, guildId);
    } catch (e) {
      log.error('CFG_EDIT_MODAL', guildId, 'Lỗi lưu field %s: %s', suffix, e.message);
      return interaction.editReply(replyErrEdit(`Không thể lưu cấu hình: ${e.message}`));
    }
  }
}

module.exports = { SetupConfigEditModalHandler };
