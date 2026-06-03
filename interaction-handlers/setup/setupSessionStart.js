'use strict';
const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const db = require('../../db.js');
const log = require('../../utils/logger.js');
const { requireAdmin } = require('../../utils/permissions.js');
const { FOOTER_DEFAULT } = require('../../utils/embeds.js');
const { fmtTs } = require('../../utils/format.js');
const { datHenGioDong, startAutoRefresh } = require('../../utils/timers.js');

const MODAL_ID = 'setup:session:start:modal';

function openStartSessionModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId(MODAL_ID)
    .setTitle('Mở phiên điểm danh mới');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('ten_phien')
        .setLabel('Tên phiên')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(100)
        .setRequired(false)
        .setPlaceholder('Để trống để đặt tên tự động'),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('mo_ta')
        .setLabel('Mô tả (tuỳ chọn)')
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(500)
        .setRequired(false),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('phut_dong')
        .setLabel('Tự động đóng sau (phút) — 0 = không tự đóng')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('15 / 30 / 60 / 90 / 120 (mặc định 0)'),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('phai_role')
        .setLabel('Role ID giới hạn (tuỳ chọn)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('VD: 123456789012345678'),
    ),
  );
  return interaction.showModal(modal);
}

async function handleStartSessionModal(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const { ok } = await requireAdmin(interaction, { context: 'mở phiên từ /setup', deferred: true });
  if (!ok) return;

  const { guild, client } = interaction;
  const existing = await db.getActiveSession(guild.id);
  if (existing) {
    return interaction.editReply({ content: `⚠️ Đang có phiên **${existing.session_name}** đang mở.` });
  }

  const sessionName = interaction.fields.getTextInputValue('ten_phien').trim() || `Phiên ${fmtTs(new Date().toISOString())}`;
  const moTa = interaction.fields.getTextInputValue('mo_ta').trim() || null;
  const phutVal = (interaction.fields.getTextInputValue('phut_dong') || '').trim() || '0';
  const phut = parseInt(phutVal, 10) || null;
  const phaiRoleId = interaction.fields.getTextInputValue('phai_role').trim() || null;

  const cfg = await db.getGuildConfig(guild.id);
  const phaiRoleIds = phaiRoleId ? [phaiRoleId] : (cfg.phai_role_ids ?? []);
  let eligibleIds = null;
  if (phaiRoleIds.length) {
    await guild.members.fetch();
    eligibleIds = guild.members.cache
      .filter(m => !m.user.bot && m.roles.cache.some(r => phaiRoleIds.includes(r.id)))
      .map(m => m.id);
  }

  const session = await db.createSession({
    guildId: guild.id, sessionName, description: moTa, eligibleMemberIds: eligibleIds, phaiRoleIds,
  });

  const embed = new EmbedBuilder()
    .setColor(0x01696f)
    .setTitle('🟢 Phiên điểm danh đã mở')
    .setDescription(`**${sessionName}**${moTa ? `\n${moTa}` : ''}`)
    .addFields(
      { name: '🆔 ID', value: `\`${session.id}\``, inline: true },
      { name: '⏱️ Bắt đầu', value: fmtTs(session.started_at ?? session.created_at), inline: true },
      { name: '⏳ Tự đóng', value: phut ? `Sau ${phut} phút` : 'Không', inline: true },
      { name: '👥 Bắt buộc', value: eligibleIds ? `${eligibleIds.length} thành viên` : 'Tất cả', inline: true },
      { name: '🎭 Phái', value: phaiRoleId ? `<@&${phaiRoleId}>` : (phaiRoleIds.length ? 'Theo cấu hình' : 'Không'), inline: true },
    )
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('attendance:select')
      .setPlaceholder('👆 Chọn trạng thái điểm danh...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('✅ Điểm danh').setDescription('Điểm danh đúng giờ').setValue('tham_gia'),
        new StringSelectMenuOptionBuilder().setLabel('⏰ Trễ').setDescription('Điểm danh muộn').setValue('tre'),
        new StringSelectMenuOptionBuilder().setLabel('❌ Không tham gia').setDescription('Báo vắng mặt').setValue('khong_tham_gia'),
        new StringSelectMenuOptionBuilder().setLabel('🏥 Có phép').setDescription('Vắng mặt có lý do').setValue('co_phep'),
      ),
  );

  const msg = await interaction.editReply({ embeds: [embed], components: [row] });

  const channel = interaction.channel;
  await db.updateSessionMessage(session.id, { messageId: msg.id, channelId: channel.id });

  startAutoRefresh(session.id, channel.id, msg.id, client);

  if (phut) {
    datHenGioDong(client, guild, session, channel.id, phut * 60_000);
  }

  if (cfg.log_channel_id) {
    const logCh = guild.channels.cache.get(cfg.log_channel_id);
    if (logCh) await logCh.send({ embeds: [embed] }).catch(() => null);
  }
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

module.exports = {
  SetupSessionStartHandler,
  SetupSessionStartModalHandler,
  openStartSessionModal,
};
