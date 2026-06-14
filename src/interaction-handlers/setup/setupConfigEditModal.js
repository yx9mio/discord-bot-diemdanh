'use strict';
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { DateTime } = require('luxon');
const configService = require('../../../services/configService.js');
const log = require('../../../utils/logger.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { auditLog } = require('../../../utils/auditLog.js');
const { replyErrEdit } = require('../../../utils/embeds.js');
const { wrapHandler } = require('../../../utils/error-boundary.js');
const { checkCooldown } = require('../../../utils/cooldown.js');

const MODAL_PREFIX = 'setup:cfg:modal:';

const FIELD_MAP = {
  tz: { col: 'timezone', inputId: 'timezone' },
};

async function _refreshConfigAndReply(interaction, guildId) {
  const cfg = await configService.getGuildConfig(guildId);
  const { ConfigView } = require('../../commands/setup/_views/_ConfigView.js');
  const msgId = ConfigView.getMessageId(guildId);
  log.info('CFG_EDIT_MODAL', guildId, '_refreshConfigAndReply msgId=%s', msgId);
  if (msgId) {
    const ch = interaction.channel;
    const msg = await ch.messages.fetch(msgId).catch(() => null);
    if (msg) {
      await msg.edit(ConfigView.render({ cfg, guild: interaction.guild })).catch(e => {
        log.warn('CFG_EDIT_MODAL', guildId, 'Edit ConfigView fail: %s', e.message);
      });
    } else {
      log.warn('CFG_EDIT_MODAL', guildId, 'ConfigView msg not found (deleted?)');
    }
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
    return wrapHandler(async (interaction) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { ok } = await requireAdmin(interaction, { context: 'sửa cấu hình', deferred: true });
    if (!ok) return;
    if (!checkCooldown(interaction.user.id, 'setup_cfg_edit_modal', 5000)) {
      return interaction.editReply({ content: '⏳ Vui lòng đợi một chút trước khi thực hiện hành động này.' });
    }
    const suffix = interaction.customId.slice(MODAL_PREFIX.length);
    const guildId = interaction.guild.id;

    if (suffix === 'emoji_name') {
      const cfg = await configService.getGuildConfig(guildId);
      const phaiIds = cfg?.phai_role_ids ?? [];
      const existing = cfg?.phai_role_icons ?? {};
      const raw = interaction.fields?.getTextInputValue('emoji_names') ?? '';
      // Parse mỗi dòng: RoleName=EmojiName
      const lines = raw.split('\n').filter(Boolean);
      const matched = [];
      const notFound = [];
      for (const line of lines) {
        const sep = line.indexOf('=');
        if (sep <= 0) continue;
        const roleName = line.slice(0, sep).trim();
        const emojiName = line.slice(sep + 1).trim();
        if (!roleName) continue;
        // Tìm roleId theo tên role
        const role = interaction.guild.roles.cache.find(r => r.name === roleName);
        if (!role) { notFound.push(roleName); continue; }
        if (emojiName) existing[role.id] = emojiName;
        else delete existing[role.id];
        matched.push({ name: roleName, emoji: emojiName || '(xóa)' });
      }
      // Xoá các entry của phái không còn trong danh sách
      for (const key of Object.keys(existing)) {
        if (!phaiIds.includes(key)) delete existing[key];
      }
      // Force sync emoji cache để tránh cache cũ
      const { syncGuildEmojis } = require('../../../services/guildEmojiService.js');
      await syncGuildEmojis(interaction.guild);
      // Debug: kiểm tra emoji nào tìm thấy trong guild cache
      const foundEmojiNames = [];
      const notFoundEmojiNames = [];
      for (const [rid, ename] of Object.entries(existing)) {
        const serverEmoji = interaction.guild.emojis?.cache?.find(e => e.name === ename);
        if (serverEmoji) foundEmojiNames.push(`${ename} (${serverEmoji.toString()})`);
        else notFoundEmojiNames.push(ename);
      }
      log.info('CFG_EDIT_MODAL', guildId,
        'emoji_name matched=%d notFoundRoles=%s existing=%j foundEmojis=%s notFoundEmojis=%s',
        matched.length, notFound.join(','), existing,
        foundEmojiNames.join(','), notFoundEmojiNames.join(','));
      try {
        await configService.setConfigField(guildId, 'phai_role_icons', existing);
        auditLog({ guildId, actorId: interaction.user.id, action: 'CONFIG_UPDATE', metadata: { field: 'phai_role_icons', suffix: 'emoji_name' } }).catch(() => {});
        await _refreshConfigAndReply(interaction, guildId);
        const summary = [
          matched.map(m => `${m.name}=${m.emoji}`).join('\n') || '_không có_',
        ];
        if (notFound.length) summary.push(`\n❌ Không tìm thấy role: ${notFound.join(', ')}`);
        if (foundEmojiNames.length) summary.push(`✅ Emoji tìm thấy: ${foundEmojiNames.join(', ')}`);
        if (notFoundEmojiNames.length) summary.push(`⚠️ Emoji không tìm thấy trên server: ${notFoundEmojiNames.join(', ')}`);
        return interaction.editReply({
          content: `✅ Đã lưu.\n\`\`\`${summary.join('\n')}\`\`\``.slice(0, 2000),
        });
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
      auditLog({ guildId, actorId: interaction.user.id, action: 'CONFIG_UPDATE', metadata: { field: mapping.col, suffix } }).catch(() => {});
      return await _refreshConfigAndReply(interaction, guildId);
    } catch (e) {
      log.error('CFG_EDIT_MODAL', guildId, 'Lỗi lưu field %s: %s', suffix, e.message);
      return interaction.editReply(replyErrEdit(`Không thể lưu cấu hình: ${e.message}`));
    }
  }, 'SetupConfigEditModalHandler')(interaction); }
}

module.exports = { SetupConfigEditModalHandler };
