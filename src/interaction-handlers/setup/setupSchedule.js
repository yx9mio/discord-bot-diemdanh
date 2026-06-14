// interaction-handlers/setup/setupSchedule.js
// [FIX-PATH] ../../../ → ../../../../
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const scheduledService = require('../../../services/scheduledService.js');
const configService    = require('../../../services/configService.js');
const log = require('../../../utils/logger.js');
const { ScheduleView } = require('../../commands/setup/_views/_ScheduleView.js');
const { CUSTOM_ID } = ScheduleView;
const { requireAdmin } = require('../../../utils/permissions.js');
const { auditLog } = require('../../../utils/auditLog.js');
const { getState, setState, clearState } = require('../../../utils/scheduleAddState.js');
const { renderAddViewStep2, renderAddViewStep1 } = require('../../../utils/scheduleAddViews.js');
const { getState: getEditState, setState: setEditState, clearState: clearEditState } = require('../../../utils/scheduleEditState.js');
const { renderEditViewStep1, renderEditViewStep2 } = require('../../../utils/scheduleEditViews.js');
const { wrapHandler } = require('../../../utils/error-boundary.js');
const { checkCooldown } = require('../../../utils/cooldown.js');

class SetupScheduleHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === 'setup:sch')                       return this.some();
    if (id === CUSTOM_ID.PAGE_NEXT || id === CUSTOM_ID.PAGE_PREV) return this.some();
    if (id === CUSTOM_ID.REFRESH)                 return this.some();
    if (id === 'setup:sch:add:r:step1:next')      return this.some();
    if (id === 'setup:sch:add:r:step1:cancel')    return this.some();
    if (id === 'setup:sch:add:r:step2:confirm')   return this.some();
    if (id === 'setup:sch:add:r:step2:cancel')    return this.some();
    if (id === 'setup:sch:edit:r:step1:next')     return this.some();
    if (id === 'setup:sch:edit:r:step1:cancel')   return this.some();
    if (id === 'setup:sch:edit:r:step2:confirm')  return this.some();
    if (id === 'setup:sch:edit:r:step2:cancel')   return this.some();
    if (id?.startsWith(CUSTOM_ID.DEL_PREFIX) &&
        !id.startsWith(CUSTOM_ID.DEL_CONFIRM) &&
        !id.startsWith(CUSTOM_ID.DEL_CANCEL))     return this.some();
    if (id?.startsWith(CUSTOM_ID.DEL_CONFIRM))    return this.some();
    if (id?.startsWith(CUSTOM_ID.DEL_CANCEL))     return this.some();
    return this.none();
  }

  async run(interaction) {
    return wrapHandler(async (interaction) => {
    const { customId, guild } = interaction;

    if (customId === CUSTOM_ID.REFRESH) {
      await interaction.deferUpdate();
      if (!checkCooldown(interaction.user.id, 'sch_refresh', 1000)) return interaction.editReply({ content: '⏳ Vui lòng đợi một chút...' });
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
      if (!checkCooldown(interaction.user.id, 'sch_list', 1000)) return interaction.editReply({ content: '⏳ Vui lòng đợi một chút...' });
      const schedules = await scheduledService.getScheduledSessions(guild.id).catch(() => []);
      return interaction.editReply(ScheduleView.render({ schedules, guild, page: 0 }));
    }

    if (customId === CUSTOM_ID.PAGE_NEXT || customId === CUSTOM_ID.PAGE_PREV) {
      await interaction.deferUpdate();
      if (!checkCooldown(interaction.user.id, 'sch_page', 1000)) return interaction.editReply({ content: '⏳ Vui lòng đợi một chút...' });
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

    // ── Add recurring schedule flow ───────────────────────────────────
    if (customId === 'setup:sch:add:r:step1:next') {
      await interaction.deferUpdate();
      if (!checkCooldown(interaction.user.id, 'sch_add_confirm', 1000)) return interaction.editReply({ content: '⏳ Vui lòng đợi một chút...' });
      setState(guild.id, interaction.user.id, { step: 2 });
      const state = getState(guild.id, interaction.user.id);
      return interaction.editReply(renderAddViewStep2(guild, state));
    }

    if (customId === 'setup:sch:add:r:step1:cancel' || customId === 'setup:sch:add:r:step2:cancel') {
      await interaction.deferUpdate();
      if (!checkCooldown(interaction.user.id, 'sch_add_cancel', 1000)) return interaction.editReply({ content: '⏳ Vui lòng đợi một chút...' });
      clearState(guild.id, interaction.user.id);
      const schedules = await scheduledService.getScheduledSessions(guild.id).catch(() => []);
      return interaction.editReply(ScheduleView.render({ schedules, guild, page: 0 }));
    }

    if (customId === 'setup:sch:add:r:step2:confirm') {
      await interaction.deferUpdate();
      if (!checkCooldown(interaction.user.id, 'sch_add_confirm', 5000)) return interaction.editReply({ content: '⏳ Vui lòng đợi một chút trước khi thực hiện hành động này.' });
      const state = getState(guild.id, interaction.user.id);
      if (state.day == null || state.hour == null || state.minute == null) {
        clearState(guild.id, interaction.user.id);
        const schedules = await scheduledService.getScheduledSessions(guild.id).catch(() => []);
        return interaction.editReply({ content: '❌ Thiếu thông tin, vui lòng thử lại.', ...ScheduleView.render({ schedules, guild, page: 0 }) });
      }
      const noAutoClose = state.closeDayOffset === '-1';
      if (!noAutoClose && (state.closeDayOffset == null || state.closeHour == null || state.closeMinute == null)) {
        clearState(guild.id, interaction.user.id);
        const schedules = await scheduledService.getScheduledSessions(guild.id).catch(() => []);
        return interaction.editReply({ content: '❌ Vui lòng chọn ngày/giờ kết thúc hoặc chọn Không tự đóng.', ...ScheduleView.render({ schedules, guild, page: 0 }) });
      }

      let closeDayOfWeek = null, closeHour = null, closeMinute = null;
      if (!noAutoClose) {
        const offset = parseInt(state.closeDayOffset, 10);
        closeDayOfWeek = (state.day + offset) % 7;
        closeHour = state.closeHour;
        closeMinute = state.closeMinute;
      }

      const gioBatDau = `${String(state.hour).padStart(2, '0')}:${String(state.minute).padStart(2, '0')}`;
      try {
        await scheduledService.addRecurringSession(guild.id, {
          thu: state.day,
          gio_bat_dau: gioBatDau,
          close_day_of_week: closeDayOfWeek,
          close_hour: closeHour,
          close_minute: closeMinute,
          ten: 'Điểm danh',
          timezone: 'Asia/Ho_Chi_Minh',
          pre_close_minutes: 30,
          channel_id: state.channel,
        });
        log.info('SCH_ADD', guild.id, 'Đã thêm lịch định kỳ');
        auditLog({ guildId: guild.id, actorId: interaction.user.id, action: 'SCHEDULE_CREATE', metadata: { type: 'recurring', day: state.day, hour: state.hour, minute: state.minute } }).catch(() => {});
      } catch (e) {
        log.error('SCH_ADD', guild.id, 'addRecurringSession lỗi: %s', e.message);
        clearState(guild.id, interaction.user.id);
        const schedules = await scheduledService.getScheduledSessions(guild.id).catch(() => []);
        return interaction.editReply({ content: `❌ Không thể thêm lịch: ${e.message}`, ...ScheduleView.render({ schedules, guild, page: 0 }) });
      }
      clearState(guild.id, interaction.user.id);
      const schedules = await scheduledService.getScheduledSessions(guild.id).catch(() => []);
      return interaction.editReply({ content: '✅ Đã thêm lịch.', ...ScheduleView.render({ schedules, guild, page: 0 }) });
    }

    // ── Edit recurring schedule flow (select menus) ───────────────────
    if (customId === 'setup:sch:edit:r:step1:next') {
      await interaction.deferUpdate();
      if (!checkCooldown(interaction.user.id, 'sch_edit_confirm', 1000)) return interaction.editReply({ content: '⏳ Vui lòng đợi một chút...' });
      const footer = interaction.message?.embeds?.[0]?.footer?.text ?? '';
      const sidMatch = footer.match(/sid:(\d+)/);
      const scheduleId = sidMatch ? sidMatch[1] : null;
      if (!scheduleId) {
        const schedules = await scheduledService.getScheduledSessions(guild.id).catch(() => []);
        return interaction.editReply(ScheduleView.render({ schedules, guild, page: 0 }));
      }
      setEditState(guild.id, interaction.user.id, scheduleId, { step: 2 });
      const state = getEditState(guild.id, interaction.user.id, scheduleId);
      return interaction.editReply(renderEditViewStep2(guild, state));
    }

    if (customId === 'setup:sch:edit:r:step1:cancel' || customId === 'setup:sch:edit:r:step2:cancel') {
      await interaction.deferUpdate();
      if (!checkCooldown(interaction.user.id, 'sch_edit_cancel', 1000)) return interaction.editReply({ content: '⏳ Vui lòng đợi một chút...' });
      const footer = interaction.message?.embeds?.[0]?.footer?.text ?? '';
      const sidMatch = footer.match(/sid:(\d+)/);
      if (sidMatch) clearEditState(guild.id, interaction.user.id, sidMatch[1]);
      const schedules = await scheduledService.getScheduledSessions(guild.id).catch(() => []);
      return interaction.editReply(ScheduleView.render({ schedules, guild, page: 0 }));
    }

    if (customId === 'setup:sch:edit:r:step2:confirm') {
      await interaction.deferUpdate();
      if (!checkCooldown(interaction.user.id, 'sch_edit_confirm', 5000)) return interaction.editReply({ content: '⏳ Vui lòng đợi một chút trước khi thực hiện hành động này.' });
      const footer = interaction.message?.embeds?.[0]?.footer?.text ?? '';
      const sidMatch = footer.match(/sid:(\d+)/);
      const scheduleId = sidMatch ? sidMatch[1] : null;
      if (!scheduleId) {
        const schedules = await scheduledService.getScheduledSessions(guild.id).catch(() => []);
        return interaction.editReply(ScheduleView.render({ schedules, guild, page: 0 }));
      }
      const state = getEditState(guild.id, interaction.user.id, scheduleId);
      if (!state || state.day == null || state.hour == null || state.minute == null) {
        clearEditState(guild.id, interaction.user.id, scheduleId);
        const schedules = await scheduledService.getScheduledSessions(guild.id).catch(() => []);
        return interaction.editReply({ content: '❌ Thiếu thông tin, vui lòng thử lại.', ...ScheduleView.render({ schedules, guild, page: 0 }) });
      }
      const noAutoClose = state.closeDayOffset === '-1';
      if (!noAutoClose && (state.closeDayOffset == null || state.closeHour == null || state.closeMinute == null)) {
        clearEditState(guild.id, interaction.user.id, scheduleId);
        const schedules = await scheduledService.getScheduledSessions(guild.id).catch(() => []);
        return interaction.editReply({ content: '❌ Vui lòng chọn ngày/giờ kết thúc hoặc chọn Không tự đóng.', ...ScheduleView.render({ schedules, guild, page: 0 }) });
      }

      let closeDayOfWeek = null, closeHour = null, closeMinute = null;
      if (!noAutoClose) {
        const offset = parseInt(state.closeDayOffset, 10);
        closeDayOfWeek = (state.day + offset) % 7;
        closeHour = state.closeHour;
        closeMinute = state.closeMinute;
      }

      const gioBatDau = `${String(state.hour).padStart(2, '0')}:${String(state.minute).padStart(2, '0')}`;
      try {
        await scheduledService.updateScheduledSession(guild.id, scheduleId, {
          day_of_week: state.day,
          hour: state.hour,
          minute: state.minute,
          close_day_of_week: closeDayOfWeek,
          close_hour: closeHour,
          close_minute: closeMinute,
          session_name: 'Điểm danh',
          channel_id: state.channel || null,
        });
        log.info('SCH_EDIT', guild.id, 'Đã sửa lịch định kỳ %s', scheduleId);
        auditLog({ guildId: guild.id, actorId: interaction.user.id, action: 'SCHEDULE_UPDATE', targetId: scheduleId, metadata: { type: 'recurring', day: state.day, hour: state.hour, minute: state.minute } }).catch(() => {});
      } catch (e) {
        log.error('SCH_EDIT', guild.id, 'updateScheduledSession lỗi: %s', e.message);
        clearEditState(guild.id, interaction.user.id, scheduleId);
        const schedules = await scheduledService.getScheduledSessions(guild.id).catch(() => []);
        return interaction.editReply({ content: `❌ Không thể lưu: ${e.message}`, ...ScheduleView.render({ schedules, guild, page: 0 }) });
      }
      clearEditState(guild.id, interaction.user.id, scheduleId);
      const schedules = await scheduledService.getScheduledSessions(guild.id).catch(() => []);
      return interaction.editReply({ content: '✅ Đã cập nhật lịch.', ...ScheduleView.render({ schedules, guild, page: 0 }) });
    }

    if (
      customId.startsWith(CUSTOM_ID.DEL_PREFIX) &&
      !customId.startsWith(CUSTOM_ID.DEL_CONFIRM) &&
      !customId.startsWith(CUSTOM_ID.DEL_CANCEL)
    ) {
      const schId = customId.slice(CUSTOM_ID.DEL_PREFIX.length);
      if (!checkCooldown(interaction.user.id, 'sch_del', 1000)) return interaction.reply({ content: '⏳ Vui lòng đợi một chút...', flags: require('discord.js').MessageFlags.Ephemeral });
      await interaction.reply({
        content: `⚠️ Xác nhận xoá lịch cố định **#${schId}**?`,
        flags: MessageFlags.Ephemeral,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`${CUSTOM_ID.DEL_CONFIRM}${schId}`).setLabel('✅ Xoá').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`${CUSTOM_ID.DEL_CANCEL}${schId}`).setLabel('↩️ Hủy').setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
      return;
    }

    if (customId.startsWith(CUSTOM_ID.DEL_CONFIRM)) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { ok } = await requireAdmin(interaction, { context: 'xoá lịch', deferred: true });
      if (!ok) return;
      if (!checkCooldown(interaction.user.id, 'sch_del_confirm', 5000)) return interaction.editReply({ content: '⏳ Vui lòng đợi một chút trước khi thực hiện hành động này.' });
      const schId = customId.slice(CUSTOM_ID.DEL_CONFIRM.length);
      try {
        await scheduledService.deleteScheduledSession(guild.id, schId);
        log.info('SCH_DEL', guild.id, 'Xoá lịch %s', schId);
        auditLog({ guildId: guild.id, actorId: interaction.user.id, action: 'SCHEDULE_DELETE', targetId: schId }).catch(() => {});
        return interaction.editReply({ content: '✅ Đã xoá lịch cố định.' });
      } catch (e) {
        log.error('SCH_DEL', guild.id, 'deleteScheduledSession thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể xoá lịch, thử lại sau.' });
      }
    }

    if (customId.startsWith(CUSTOM_ID.DEL_CANCEL)) {
      await interaction.deferUpdate();
      if (!checkCooldown(interaction.user.id, 'sch_del_cancel', 1000)) return interaction.editReply({ content: '⏳ Vui lòng đợi một chút...' });
      const schedules = await scheduledService.getScheduledSessions(guild.id).catch(() => []);
      return interaction.editReply({ ...ScheduleView.render({ schedules, guild, page: 0 }), content: null });
    }
  }, 'SetupScheduleHandler')(interaction); }
}

module.exports = { SetupScheduleHandler };
