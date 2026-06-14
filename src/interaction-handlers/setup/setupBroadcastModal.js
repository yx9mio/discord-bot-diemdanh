// src/interaction-handlers/setup/setupBroadcastModal.js
// Handles: setup:session:broadcast:modal (ModalSubmit)
// [FIX-PATH] ../../../ → ../../../../
'use strict';
const { MessageFlags, EmbedBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { getGuildConfig } = require('../../../services/configService.js');
const log = require('../../../utils/logger.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { FOOTER_DEFAULT, replyErrEdit } = require('../../../utils/embeds.js');
const { wrapHandler } = require('../../../utils/error-boundary.js');

const BROADCAST_MODAL_ID = 'setup:session:broadcast:modal';

class SetupBroadcastModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId === BROADCAST_MODAL_ID) return this.some();
    return this.none();
  }

  async run(interaction) {
    return wrapHandler(async (interaction) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { ok } = await requireAdmin(interaction, { context: 'phát tin', deferred: true });
    if (!ok) return;

    const { guild, channel } = interaction;
    const content = interaction.fields.getTextInputValue('message').trim();
    if (!content) return interaction.editReply(replyErrEdit('Nội dung tin nhắn không được để trống.'));
    if (content.length > 4000) {
      return interaction.editReply(replyErrEdit(`Nội dung quá dài (${content.length}/4000 ký tự tối đa).`));
    }

    const targetChannelId = interaction.fields.getTextInputValue('channel_id')?.trim() || null;
    const targetChannel = targetChannelId
      ? await guild.channels.fetch(targetChannelId).catch(() => null)
      : channel;
    if (targetChannelId && !targetChannel) {
      return interaction.editReply(replyErrEdit(`Không tìm thấy kênh: ${targetChannelId}`));
    }

    const authorName = interaction.member?.displayName ?? interaction.user.username;
    const embed = new EmbedBuilder()
      .setColor(0x5865f2).setTitle('📢 Thông báo').setDescription(content)
      .setAuthor({ name: authorName, iconURL: interaction.user.displayAvatarURL({ extension: 'png' }) })
      .setFooter({ text: FOOTER_DEFAULT }).setTimestamp();

    await targetChannel.send({ embeds: [embed] }).catch(e => log.warn('BROADCAST', guild.id, 'Gửi broadcast thất bại: %s', e.message));

    try {
      const cfg = await getGuildConfig(guild.id);
      if (cfg?.notification_channel_id && cfg.notification_channel_id !== channel.id) {
        const logCh = guild.channels.cache.get(cfg.notification_channel_id);
        if (logCh) await logCh.send({ embeds: [embed] }).catch(() => null);
      }
    } catch (e) {
      log.warn('BROADCAST', guild.id, 'Không thể gửi tới notification channel: %s', e.message);
    }

    log.info('BROADCAST', guild.id, '%s phát tin: %.50s', authorName, content);
    return interaction.editReply({ content: '✅ Đã gửi thông báo.' });
  }, 'SetupBroadcastModalHandler')(interaction); }
}

module.exports = { SetupBroadcastModalHandler };
