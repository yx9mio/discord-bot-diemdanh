// interaction-handlers/setup/setupSchedule.js
// [FIX-PATH] ../../../ → ../../../../
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
        ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const scheduledService = require('../../services/scheduledService.js');
const log = require('../../utils/logger.js');
const { ScheduleView } = require('../../commands/setup/_views/_ScheduleView.js');
const { MODAL_RECURRING_ID, MODAL_ONETIME_ID } = require('./setupScheduleAddDetailModal.js');
const { CUSTOM_ID } = ScheduleView;
const { requireAdmin } = require('../../utils/permissions.js');

class SetupScheduleHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === 'setup:sch')           return this.some();
    if (id === CUSTOM_ID.ADD_R)       return this.some();
    if (id === CUSTOM_ID.ADD_O)       return this.some();
    if (id === CUSTOM_ID.PAGE_NEXT || id === CUSTOM_ID.PAGE_PREV) return this.some();
    if (id === CUSTOM_ID.REFRESH)     return this.some();
    if (id?.startsWith(CUSTOM_ID.DEL_PREFIX) &&
        !id.startsWith(CUSTOM_ID.DEL_CONFIRM) &&
        !id.startsWith(CUSTOM_ID.DEL_CANCEL))  return this.some();
    if (id?.startsWith(CUSTOM_ID.DEL_CONFIRM)) return this.some();
    if (id?.startsWith(CUSTOM_ID.DEL_CANCEL))  return this.some();
    return this.none();
  }

  async run(interaction) {
    const { customId, guild } = interaction;

    if (customId === CUSTOM_ID.ADD_R) {
      return interaction.showModal(
        new ModalBuilder()
          .setCustomId(MODAL_RECURRING_ID)
          .setTitle('Thêm lịch hàng tuần')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('day_of_week')
                .setLabel('Ngày trong tuần (t2, t3, t4, t5, t6, t7, cn)')
                .setStyle(TextInputStyle.Short).setPlaceholder('t7').setRequired(true),
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('gio_mo')
                .setLabel('Giờ mở phiên (HH:MM)')
                .setStyle(TextInputStyle.Short).setPlaceholder('21:00').setRequired(true),
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('phut_bu')
                .setLabel('Phiên dài bao nhiêu phút? (0 = không tự đóng)')
                .setStyle(TextInputStyle.Short).setPlaceholder('30').setRequired(false),
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('pre_close')
                .setLabel('Nhắc trước bao nhiêu phút? (mặc định 30)')
                .setStyle(TextInputStyle.Short).setPlaceholder('30').setRequired(false),
            ),
          ),
      );
    }

    if (customId === CUSTOM_ID.ADD_O) {
      return interaction.showModal(
        new ModalBuilder()
          .setCustomId(MODAL_ONETIME_ID)
          .setTitle('Thêm lịch một lần')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('ngay')
                .setLabel('Ngày (DD/MM/YYYY hoặc YYYY-MM-DD)')
                .setStyle(TextInputStyle.Short).setPlaceholder('07/06/2026').setRequired(true),
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('gio_mo')
                .setLabel('Giờ mở phiên (HH:MM)')
                .setStyle(TextInputStyle.Short).setPlaceholder('21:00').setRequired(true),
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('phut_bu')
                .setLabel('Phiên dài bao nhiêu phút? (0 = không tự đóng)')
                .setStyle(TextInputStyle.Short).setPlaceholder('30').setRequired(false),
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('pre_close')
                .setLabel('Nhắc trước bao nhiêu phút? (mặc định 30)')
                .setStyle(TextInputStyle.Short).setPlaceholder('30').setRequired(false),
            ),
          ),
      );
    }

    if (customId === CUSTOM_ID.REFRESH) {
      await interaction.deferUpdate();
      let page = 0;
      try {
        const footer = interaction.message?.embeds?.[0]?.footer?.text ?? '';
        const m = footer.match(/Trang (\d+)\/(\d+)/);
        if (m) page = parseInt(m[1], 10) - 1;
      } catch { /* ignore */ }
      const schedules = await scheduledService.getScheduledSessions(guild.id).catch(() => []);
      return interaction.editReply(ScheduleView.render({ schedules, guild, page }));
    }

    if (customId === 'setup:sch') {
      await interaction.deferUpdate();
      const schedules = await scheduledService.getScheduledSessions(guild.id).catch(() => []);
      return interaction.editReply(ScheduleView.render({ schedules, guild, page: 0 }));
    }

    if (customId === CUSTOM_ID.PAGE_NEXT || customId === CUSTOM_ID.PAGE_PREV) {
      await interaction.deferUpdate();
      let currentPage = 0;
      try {
        const footer = interaction.message?.embeds?.[0]?.footer?.text ?? '';
        const m = footer.match(/Trang (\d+)\/(\d+)/);
        if (m) currentPage = parseInt(m[1], 10) - 1;
      } catch { /* ignore */ }
      const schedules = await scheduledService.getScheduledSessions(guild.id).catch(() => []);
      const totalPages = Math.max(1, Math.ceil(schedules.length / (ScheduleView.PAGE_SIZE ?? 5)));
      const newPage = customId === CUSTOM_ID.PAGE_NEXT
        ? Math.min(totalPages - 1, currentPage + 1)
        : Math.max(0, currentPage - 1);
      return interaction.editReply(ScheduleView.render({ schedules, guild, page: newPage }));
    }

    if (
      customId.startsWith(CUSTOM_ID.DEL_PREFIX) &&
      !customId.startsWith(CUSTOM_ID.DEL_CONFIRM) &&
      !customId.startsWith(CUSTOM_ID.DEL_CANCEL)
    ) {
      const schId = customId.slice(CUSTOM_ID.DEL_PREFIX.length);
      await interaction.reply({
        content: `⚠️ Xác nhận xoá lịch cố định **#${schId}**?`,
        flags: MessageFlags.Ephemeral,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`${CUSTOM_ID.DEL_CONFIRM}${schId}`).setLabel('✅ Xoá').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`${CUSTOM_ID.DEL_CANCEL}${schId}`).setLabel('↩️ Huỷ').setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
      return;
    }

    if (customId.startsWith(CUSTOM_ID.DEL_CONFIRM)) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { ok } = await requireAdmin(interaction, { context: 'xoá lịch', deferred: true });
      if (!ok) return;
      const schId = customId.slice(CUSTOM_ID.DEL_CONFIRM.length);
      try {
        await scheduledService.deleteScheduledSession(guild.id, schId);
        log.info('SCH_DEL', guild.id, 'Xoá lịch %s', schId);
        return interaction.editReply({ content: '✅ Đã xoá lịch cố định.' });
      } catch (e) {
        log.error('SCH_DEL', guild.id, 'deleteScheduledSession thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể xoá lịch, thử lại sau.' });
      }
    }

    if (customId.startsWith(CUSTOM_ID.DEL_CANCEL)) {
      await interaction.deferUpdate();
      const schedules = await scheduledService.getScheduledSessions(guild.id).catch(() => []);
      return interaction.editReply({ ...ScheduleView.render({ schedules, guild, page: 0 }), content: null });
    }
  }
}

module.exports = { SetupScheduleHandler };
