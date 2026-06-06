'use strict';
const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const configService = require('../../services/configService.js');
const { requireAdmin } = require('../../utils/permissions.js');
const { replyErrEdit, replyOkEdit } = require('../../utils/replies.js');
const log = require('../../utils/logger.js');

class SetupBroadcastHandler extends InteractionHandler {
  constructor(ctx, opts) {
    super(ctx, { ...opts, interactionHandlerType: InteractionHandlerTypes.Button });
  }
  parse(interaction) {
    return interaction.customId === 'setup:broadcast' ? this.some() : this.none();
  }
  async run(interaction) {
    const { ok } = await requireAdmin(interaction, { context: 'broadcast' });
    if (!ok) return;

    const modal = new ModalBuilder()
      .setCustomId('setup:broadcast_modal')
      .setTitle('Gửi thông báo')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('message')
            .setLabel('Nội dung thông báo')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(4000)
            .setRequired(true)
            .setPlaceholder('Nhập nội dung thông báo...'),
        ),
      );
    return interaction.showModal(modal);
  }
}

class SetupBroadcastModalHandler extends InteractionHandler {
  constructor(ctx, opts) {
    super(ctx, { ...opts, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }
  parse(interaction) {
    return interaction.customId === 'setup:broadcast_modal' ? this.some() : this.none();
  }
  async run(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { guild } = interaction;

    let content = '';
    content = interaction.fields.getTextInputValue('message').trim();
    if (!content) {
      return interaction.editReply({ content: '❌ Nội dung tin nhắn không được để trống.' });
    }
    // [SEC-FIX-4] Giới hạn 4000 ký tự — Discord Embed description max 4096
    if (content.length > 4000) {
      return interaction.editReply({ content: `❌ Nội dung quá dài (${content.length}/4000 ký tự tối đa).` });
    }

    // [FIX] user.tag deprecated trong djs v14 — dùng user.username thay thế
    const authorName = interaction.member?.displayName ?? interaction.user.username;

    const cfg = await configService.getGuildConfig(guild.id);
    const targetChannelId = cfg?.broadcast_channel_id ?? cfg?.session_channel_id ?? interaction.channelId;
    const targetChannel = await guild.channels.fetch(targetChannelId).catch(() => null);
    if (!targetChannel) {
      return interaction.editReply(replyErrEdit('❌ Không tìm thấy kênh broadcast. Vui lòng cấu hình lại.'));
    }

    const embed = new EmbedBuilder()
      .setTitle('📢 Thông báo')
      .setDescription(content)
      .setFooter({ text: `Gửi bởi ${authorName}` })
      .setTimestamp()
      .setColor(0x5865f2);

    try {
      await targetChannel.send({ embeds: [embed] });
    } catch (e) {
      log.error('BROADCAST', guild.id, 'gửi broadcast lỗi: %s', e?.message ?? e);
      return interaction.editReply(replyErrEdit('⚠️ Không thể gửi thông báo vào kênh. Kiểm tra quyền bot.'));
    }

    return interaction.editReply({ content: '✅ Đã gửi thông báo.' });
  }
}

module.exports = { SetupBroadcastHandler, SetupBroadcastModalHandler };
