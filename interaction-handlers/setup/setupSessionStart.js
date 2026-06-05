'use strict';
const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const sessionService = require('../../services/sessionService.js');
const configService  = require('../../services/configService.js');
const log = require('../../utils/logger.js');
const { requireAdmin } = require('../../utils/permissions.js');
const { FOOTER_DEFAULT } = require('../../utils/embeds.js');
const { fmtTs } = require('../../utils/format.js');
const { datHenGioDong, startAutoRefresh } = require('../../utils/timers.js');

const MODAL_ID = 'setup:session:start:modal';

function openStartSessionModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId(MODAL_ID)
    .setTitle('M\u1edf phi\u00ean \u0111i\u1ec3m danh m\u1edbi');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('ten_phien')
        .setLabel('T\u00ean phi\u00ean')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(100)
        .setRequired(false)
        .setPlaceholder('\u0110\u1ec3 tr\u1ed1ng \u0111\u1ec3 \u0111\u1eb7t t\u00ean t\u1ef1 \u0111\u1ed9ng'),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('mo_ta')
        .setLabel('M\u00f4 t\u1ea3 (tu\u1ef3 ch\u1ecdn)')
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(500)
        .setRequired(false),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('phut_dong')
        .setLabel('T\u1ef1 \u0111\u1ed9ng \u0111\u00f3ng sau (ph\u00fat) \u2014 0 = kh\u00f4ng t\u1ef1 \u0111\u00f3ng')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('15 / 30 / 60 / 90 / 120 (m\u1eb7c \u0111\u1ecbnh 0)'),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('phai_role')
        .setLabel('Role ID gi\u1edbi h\u1ea1n (tu\u1ef3 ch\u1ecdn)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('VD: 123456789012345678'),
    ),
  );
  return interaction.showModal(modal);
}

async function handleStartSessionModal(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const { ok } = await requireAdmin(interaction, { context: 'm\u1edf phi\u00ean t\u1eeb /setup', deferred: true });
  if (!ok) return;

  const { guild, client } = interaction;
  const existing = await sessionService.getActiveSession(guild.id);
  if (existing) {
    return interaction.editReply({ content: `\u26a0\ufe0f \u0110ang c\u00f3 phi\u00ean **${existing.session_name}** \u0111ang m\u1edf.` });
  }

  const sessionName = interaction.fields.getTextInputValue('ten_phien').trim() || `Phi\u00ean ${fmtTs(new Date().toISOString())}`;
  const moTa = interaction.fields.getTextInputValue('mo_ta').trim() || null;
  const phutVal = (interaction.fields.getTextInputValue('phut_dong') || '').trim() || '0';
  const phut = parseInt(phutVal, 10) || null;
  const phaiRoleId = interaction.fields.getTextInputValue('phai_role').trim() || null;

  const cfg = await configService.getGuildConfig(guild.id);
  const phaiRoleIds = phaiRoleId ? [phaiRoleId] : (cfg.phai_role_ids ?? []);
  let eligibleIds = null;
  if (phaiRoleIds.length) {
    await guild.members.fetch();
    eligibleIds = guild.members.cache
      .filter(m => !m.user.bot && m.roles.cache.some(r => phaiRoleIds.includes(r.id)))
      .map(m => m.id);
  }

  const session = await sessionService.createSession({
    guildId: guild.id, sessionName, description: moTa, eligibleMemberIds: eligibleIds, phaiRoleIds,
  });

  const embed = new EmbedBuilder()
    .setColor(0x01696f)
    .setTitle('\uD83D\uDFE2 Phi\u00ean \u0111i\u1ec3m danh \u0111\u00e3 m\u1edf')
    .setDescription(`**${sessionName}**${moTa ? `\n${moTa}` : ''}`)
    .addFields(
      { name: '\uD83C\uDD94 ID', value: `\`${session.id}\``, inline: true },
      { name: '\u23f1\ufe0f B\u1eaft \u0111\u1ea7u', value: fmtTs(session.started_at ?? session.created_at), inline: true },
      { name: '\u23f3 T\u1ef1 \u0111\u00f3ng', value: phut ? `Sau ${phut} ph\u00fat` : 'Kh\u00f4ng', inline: true },
      { name: '\uD83D\uDC65 B\u1eaft bu\u1ed9c', value: eligibleIds ? `${eligibleIds.length} th\u00e0nh vi\u00ean` : 'T\u1ea5t c\u1ea3', inline: true },
      { name: '\uD83C\uDFA D\u00f3ng', value: phaiRoleId ? `<@&${phaiRoleId}>` : (phaiRoleIds.length ? 'Theo c\u1ea5u h\u00ecnh' : 'Kh\u00f4ng'), inline: true },
    )
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('attendance:select')
      .setPlaceholder('\uD83D\uDC46 Ch\u1ecdn tr\u1ea1ng th\u00e1i \u0111i\u1ec3m danh...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('\u2705 \u0110i\u1ec3m danh').setDescription('\u0110i\u1ec3m danh \u0111\u00fang gi\u1edd').setValue('tham_gia'),
        new StringSelectMenuOptionBuilder().setLabel('\u23f0 Tr\u1ec5').setDescription('\u0110i\u1ec3m danh mu\u1ed9n').setValue('tre'),
        new StringSelectMenuOptionBuilder().setLabel('\u274c Kh\u00f4ng tham gia').setDescription('B\u00e1o v\u1eafng m\u1eb7t').setValue('khong_tham_gia'),
        new StringSelectMenuOptionBuilder().setLabel('\uD83C\uDFE5 C\u00f3 ph\u00e9p').setDescription('V\u1eafng m\u1eb7t c\u00f3 l\u00fd do').setValue('co_phep'),
      ),
  );

  // [FIX-C] Ephemeral reply ch\u1ec9 \u0111\u1ec3 confirm cho admin.
  // Embed phi\u00ean + select menu ph\u1ea3i g\u1eedi ra PUBLIC channel \u0111\u1ec3:
  //   1. L\u1ea5y \u0111\u01b0\u1ee3c messageId th\u1eadt (ephemeral kh\u00f4ng c\u00f3 public msg.id)
  //   2. Th\u00e0nh vi\u00ean th\u1ea5y v\u00e0 b\u1ea5m \u0111i\u1ec3m danh \u0111\u01b0\u1ee3c
  const targetChannel = cfg.notification_channel_id
    ? (guild.channels.cache.get(cfg.notification_channel_id) ?? interaction.channel)
    : interaction.channel;

  const msg = await targetChannel.send({ embeds: [embed], components: [row] });
  await sessionService.updateSessionMessage(session.id, { messageId: msg.id, channelId: targetChannel.id });

  startAutoRefresh(session.id, targetChannel.id, msg.id, client);

  if (phut) {
    datHenGioDong(client, guild, session, targetChannel.id, phut * 60_000);
  }

  // Confirm ephemeral cho admin
  return interaction.editReply({
    content: `\u2705 \u0110\u00e3 m\u1edf phi\u00ean **${sessionName}** t\u1ea1i <#${targetChannel.id}>.`,
  });
}

class SetupSessionStartHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (interaction.customId === 'setup:session:start') return this.some();
    return this.none();
  }

  run(interaction) {
    return openStartSessionModal(interaction);
  }
}

class SetupSessionStartModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId === MODAL_ID) return this.some();
    return this.none();
  }

  run(interaction) {
    return handleStartSessionModal(interaction);
  }
}

module.exports = { SetupSessionStartHandler, SetupSessionStartModalHandler };
