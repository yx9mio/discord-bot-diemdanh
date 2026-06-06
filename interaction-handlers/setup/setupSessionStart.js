'use strict';
const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const sessionService = require('../../services/sessionService.js');
const configService  = require('../../services/configService.js');
const memberService  = require('../../services/memberService.js');
const { buildSessionEmbed, buildSessionButtons } = require('../../utils/sessionEmbed.js');
const { requireAdmin } = require('../../utils/permissions.js');
const { replyErrEdit, replyOkEdit } = require('../../utils/replies.js');
const { fmtTs } = require('../../utils/format.js');
const { scheduleAutoClose, agendaHenGio } = require('../../utils/sessionScheduler.js');
const log = require('../../utils/logger.js');

class SetupSessionStartHandler extends InteractionHandler {
  constructor(ctx, opts) {
    super(ctx, { ...opts, interactionHandlerType: InteractionHandlerTypes.Button });
  }
  parse(interaction) {
    return interaction.customId === 'setup:session_start' ? this.some() : this.none();
  }
  async run(interaction) {
    const { guild } = interaction;
    const { ok } = await requireAdmin(interaction, { context: 'mở phiên' });
    if (!ok) return;

    const existing = await sessionService.getActiveSession(guild.id);
    if (existing) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      return interaction.editReply({ content: `⚠️ Đang có phiên **${existing.session_name}** đang mở.` });
    }

    const modal = new ModalBuilder()
      .setCustomId('setup:session_start_modal')
      .setTitle('Mở phiên điểm danh')
      .addComponents(
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
            .setMaxLength(200)
            .setRequired(false),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('phut_dong')
            .setLabel('Tự đóng sau X phút (0 = không tự đóng)')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(4)
            .setRequired(false)
            .setPlaceholder('0'),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('phai_role')
            .setLabel('Role bắt buộc (ID, để trống = ai cũng được)')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(20)
            .setRequired(false),
        ),
      );
    return interaction.showModal(modal);
  }
}

class SetupSessionStartModalHandler extends InteractionHandler {
  constructor(ctx, opts) {
    super(ctx, { ...opts, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }
  parse(interaction) {
    return interaction.customId === 'setup:session_start_modal' ? this.some() : this.none();
  }
  async run(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { guild } = interaction;

    const existing = await sessionService.getActiveSession(guild.id);
    if (existing) {
      return interaction.editReply({ content: `⚠️ Đang có phiên **${existing.session_name}** đang mở.` });
    }

    // [SEC-FIX-3] slice phòng thủ — Discord modal maxLength enforce trước, đây là safety net
    const sessionName = (interaction.fields.getTextInputValue('ten_phien').trim() || `Phiên ${fmtTs(new Date().toISOString())}`).slice(0, 100);
    const moTa = (interaction.fields.getTextInputValue('mo_ta').trim() || null)?.slice(0, 200) ?? null;
    const phutVal = (interaction.fields.getTextInputValue('phut_dong') || '').trim() || '0';
    const phut = parseInt(phutVal, 10) || null;
    const phaiRoleId = interaction.fields.getTextInputValue('phai_role').trim() || null;

    const cfg = await configService.getGuildConfig(guild.id);
    const targetChannelId = cfg?.session_channel_id ?? interaction.channelId;
    const targetChannel = await guild.channels.fetch(targetChannelId).catch(() => null);
    if (!targetChannel) {
      return interaction.editReply(replyErrEdit('❌ Không tìm thấy kênh phiên. Vui lòng cấu hình lại.'));
    }

    let session;
    try {
      session = await sessionService.createSession({
        guild_id: guild.id,
        sessionName,
        description: moTa,
        autoCloseMinutes: phut,
        requiredRoleId: phaiRoleId,
      });
    } catch (e) {
      log.error('SESSION_START', guild.id, 'createSession lỗi: %s', e?.message ?? e);
      return interaction.editReply(replyErrEdit('⚠️ Không thể tạo phiên do lỗi DB. Thử lại sau.'));
    }

    const attendances = [];
    const embed = await buildSessionEmbed(session, attendances, guild);
    const buttons = buildSessionButtons();

    let sessionMsg;
    try {
      sessionMsg = await targetChannel.send({ embeds: [embed], components: [buttons] });
    } catch (e) {
      log.error('SESSION_START', guild.id, 'gửi embed phiên lỗi: %s', e?.message ?? e);
      await sessionService.cancelSession(session.id).catch(() => {});
      return interaction.editReply(replyErrEdit('⚠️ Không thể gửi embed phiên vào kênh. Kiểm tra quyền bot.'));
    }

    await sessionService.updateSessionMessageId(session.id, sessionMsg.id, targetChannelId).catch(() => {});

    if (phut && phut > 0) {
      scheduleAutoClose(guild, session, phut, targetChannel, sessionMsg);
    }

    return interaction.editReply({
      content: `✅ Đã mở phiên **${sessionName}** tại <#${targetChannel.id}>.`,
    });
  }
}

module.exports = { SetupSessionStartHandler, SetupSessionStartModalHandler };
