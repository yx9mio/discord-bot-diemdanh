'use strict';
const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { getGuildConfig } = require('../../services/configService.js');
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
      .setTitle('\uD83D\uDCE2 Ph\u00e1t tin')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('message')
            .setLabel('N\u1ed9i dung tin nh\u1eafn')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(1900)
            .setRequired(true)
            .setPlaceholder('Nh\u1eadp n\u1ed9i dung c\u1ea7n g\u1eedi...'),
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
    const { ok } = await requireAdmin(interaction, { context: 'ph\u00e1t tin', deferred: true });
    if (!ok) return;

    const { guild, channel } = interaction;
    const content = interaction.fields.getTextInputValue('message').trim();
    if (!content) {
      return interaction.editReply({ content: '\u274c N\u1ed9i dung tin nh\u1eafn kh\u00f4ng \u0111\u01b0\u1ee3c \u0111\u1ec3 tr\u1ed1ng.' });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('\uD83D\uDCE2 Th\u00f4ng b\u00e1o')
      .setDescription(content)
      .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
      .setFooter({ text: FOOTER_DEFAULT })
      .setTimestamp();

    await channel.send({ embeds: [embed] }).catch(e => log.warn('BROADCAST', guild.id, 'G\u1eedi broadcast th\u1ea5t b\u1ea1i: %s', e.message));

    // [FIX-B] D\u00f9ng notification_channel_id thay v\u00ec log_channel_id (field kh\u00f4ng t\u1ed3n t\u1ea1i)
    try {
      const cfg = await getGuildConfig(guild.id);
      if (cfg?.notification_channel_id && cfg.notification_channel_id !== channel.id) {
        const logCh = guild.channels.cache.get(cfg.notification_channel_id);
        if (logCh) await logCh.send({ embeds: [embed] }).catch(() => null);
      }
    } catch (e) {
      log.warn('BROADCAST', guild.id, 'Kh\u00f4ng th\u1ec3 g\u1eedi t\u1edbi notification channel: %s', e.message);
    }

    log.info('BROADCAST', guild.id, '%s ph\u00e1t tin: %.50s', interaction.user.tag, content);
    return interaction.editReply({ content: '\u2705 \u0110\u00e3 g\u1eedi th\u00f4ng b\u00e1o.' });
  }
}

module.exports = { SetupBroadcastHandler, SetupBroadcastModalHandler };
