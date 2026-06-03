'use strict';
const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const db = require('../../db.js');
const log = require('../../utils/logger.js');
const { requireAdmin } = require('../../utils/permissions.js');
const { FOOTER_DEFAULT } = require('../../utils/embeds.js');

const BROADCAST_MODAL_ID = 'setup:session:broadcast:modal';

class SetupBroadcastHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (interaction.customId === 'setup:session:broadcast') return this.some();
    return this.none();
  }

  run(interaction) {
    const modal = new ModalBuilder()
      .setCustomId(BROADCAST_MODAL_ID)
      .setTitle('📢 Phát tin')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('message')
            .setLabel('Nội dung tin nhắn')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(1900)
            .setRequired(true)
            .setPlaceholder('Nhập nội dung cần gửi...'),
        ),
      );
    return interaction.showModal(modal);
  }
}

class SetupBroadcastModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId === BROADCAST_MODAL_ID) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { ok } = await requireAdmin(interaction, { context: 'phát tin', deferred: true });
    if (!ok) return;

    const { guild, channel } = interaction;
    const content = interaction.fields.getTextInputValue('message').trim();
    if (!content) {
      return interaction.editReply({ content: '❌ Nội dung tin nhắn không được để trống.' });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('📢 Thông báo')
      .setDescription(content)
      .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
      .setFooter({ text: FOOTER_DEFAULT })
      .setTimestamp();

    // Gửi vào kênh hiện tại
    await channel.send({ embeds: [embed] });

    // Gửi vào log channel nếu có
    try {
      const cfg = await db.getGuildConfig(guild.id);
      if (cfg?.log_channel_id && cfg.log_channel_id !== channel.id) {
        const logCh = guild.channels.cache.get(cfg.log_channel_id);
        if (logCh) await logCh.send({ embeds: [embed] }).catch(() => null);
      }
    } catch (e) {
      log.warn('BROADCAST', guild.id, 'Không thể gửi tới log channel: %s', e.message);
    }

    log.info('BROADCAST', guild.id, '%s phát tin: %.50s', interaction.user.tag, content);
    return interaction.editReply({ content: '✅ Đã gửi thông báo.' });
  }
}

module.exports = { SetupBroadcastHandler, SetupBroadcastModalHandler };
