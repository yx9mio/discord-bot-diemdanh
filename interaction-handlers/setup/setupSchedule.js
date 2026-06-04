// interaction-handlers/setup/setupSchedule.js
// [FIX-DB] Thay db.js → scheduledService
'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const scheduledService = require('../../services/scheduledService.js');
const log = require('../../utils/logger.js');
const { ScheduleView } = require('../../src/commands/setup/_ScheduleView.js');
const { CUSTOM_ID } = ScheduleView;
const {
  openRecurringDetailModal,
  openOneTimeCombinedModal,
  _buildOneTimeCombinedModal,
} = require('./setupScheduleAddTypeModal.js');

class SetupScheduleHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === 'setup:sch') return this.some();
    if (id === CUSTOM_ID.PAGE_NEXT || id === CUSTOM_ID.PAGE_PREV) return this.some();
    if (id?.startsWith(CUSTOM_ID.DEL_PREFIX) || id?.startsWith(CUSTOM_ID.DEL_CONFIRM) || id?.startsWith(CUSTOM_ID.DEL_CANCEL)) return this.some();
    if (id?.startsWith(CUSTOM_ID.EDIT_PREFIX) &&
        !id.startsWith(CUSTOM_ID.DEL_PREFIX) &&
        !id.startsWith(CUSTOM_ID.PAGE_NEXT) &&
        !id.startsWith(CUSTOM_ID.PAGE_PREV)) return this.some();
    if (id === CUSTOM_ID.ADD_R || id === CUSTOM_ID.ADD_O) return this.some();
    return this.none();
  }

  async run(interaction) {
    const { customId, guild } = interaction;

    if (customId === CUSTOM_ID.ADD_R) {
      return openRecurringDetailModal(interaction);
    }

    if (customId === CUSTOM_ID.ADD_O) {
      return openOneTimeCombinedModal(interaction);
    }

    if (customId.startsWith(CUSTOM_ID.EDIT_PREFIX)) {
      const scheduleId = customId.slice(CUSTOM_ID.EDIT_PREFIX.length);
      let scheduleType = null;
      try {
        const schedule = await Promise.race([
          scheduledService.getScheduledSessionById(scheduleId),
          new Promise(res => setTimeout(() => res(null), 1500)),
        ]);
        scheduleType = schedule?.schedule_type ?? null;
      } catch (e) {
        log.warn('SETUP_SCH_EDIT', guild?.id, 'getScheduledSessionById err: %s', e.message);
      }

      if (scheduleType === 'one_time') {
        return interaction.showModal(
          _buildOneTimeCombinedModal({ submitCustomId: `setup:sch:edit:ot:submit:${scheduleId}` }),
        );
      }
      return openRecurringDetailModal(interaction, {}, scheduleId);
    }

    if (customId.startsWith(CUSTOM_ID.DEL_CONFIRM)) {
      await interaction.deferUpdate();
      const scheduleId = customId.slice(CUSTOM_ID.DEL_CONFIRM.length);
      const schedule = await scheduledService.getScheduledSessionById(scheduleId);
      if (!schedule) {
        const schedules = await scheduledService.getScheduledSessions(guild.id);
        const curPage = _extractPageFromEmbed(interaction);
        return interaction.editReply(ScheduleView.render({ schedules, page: curPage, guild }));
      }
      try {
        await scheduledService.deleteScheduledSession(scheduleId);
        log.info('SETUP_SCH', guild.id, 'Xoà lịch %s', scheduleId);
      } catch (e) {
        log.error('SETUP_SCH', guild.id, 'deleteScheduledSession thất bại: %s', e.message);
      }
      const schedules = await scheduledService.getScheduledSessions(guild.id);
      const curPage = _extractPageFromEmbed(interaction);
      return interaction.editReply(ScheduleView.render({ schedules, page: curPage, guild }));
    }

    if (customId.startsWith(CUSTOM_ID.DEL_CANCEL)) {
      await interaction.deferUpdate();
      const schedules = await scheduledService.getScheduledSessions(guild.id);
      const curPage = _extractPageFromEmbed(interaction);
      return interaction.editReply(ScheduleView.render({ schedules, page: curPage, guild }));
    }

    await interaction.deferUpdate();

    if (customId.startsWith(CUSTOM_ID.DEL_PREFIX)) {
      const scheduleId = customId.slice(CUSTOM_ID.DEL_PREFIX.length);
      const schedule = await scheduledService.getScheduledSessionById(scheduleId);
      if (!schedule) {
        const schedules = await scheduledService.getScheduledSessions(guild.id);
        const curPage = _extractPageFromEmbed(interaction);
        return interaction.editReply(ScheduleView.render({ schedules, page: curPage, guild }));
      }
      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setDescription(`⚠️ Bạn có chắc muốn xoà lịch cố định **${schedule.session_name}**?\n> Hành động này không thể hoàn tác.`)
        .setFooter({ text: 'Bấm ✅ Xác nhận để xoà, ↩️ Hủy để quay lại' });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(CUSTOM_ID.DEL_CONFIRM + scheduleId).setLabel('✅ Xác nhận').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(CUSTOM_ID.DEL_CANCEL + scheduleId).setLabel('↩️ Hủy').setStyle(ButtonStyle.Secondary),
      );
      return interaction.editReply({ embeds: [embed], components: [row] });
    }

    const schedules = await scheduledService.getScheduledSessions(guild.id);
    const curPage = _extractPageFromEmbed(interaction);
    const newPage = Math.max(0, curPage + (customId === CUSTOM_ID.PAGE_NEXT ? 1 : -1));
    return interaction.editReply(ScheduleView.render({ schedules, page: newPage, guild }));
  }
}

function _extractPageFromEmbed(interaction) {
  try {
    const embed = interaction.message?.embeds?.[0];
    const footer = embed?.footer?.text ?? '';
    const match = footer.match(/Trang (\d+)\/(\d+)/);
    if (match) return Math.max(0, parseInt(match[1], 10) - 1);
  } catch (_e) { /* fallthrough */ }
  return 0;
}

module.exports = { SetupScheduleHandler };
