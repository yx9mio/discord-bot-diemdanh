// interaction-handlers/setup/setupSchedule.js
// Handles:
//   - setup:sch (mở Schedule view trang 0)
//   - setup:sch:page:next / :prev (phân trang)
//   - setup:sch:del:<scheduleId> (xoá 1 lịch)
//   - setup:sch:add, setup:sch:edit:<id> → modal ở Commit 5
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const db = require('../../db.js');
const log = require('../../utils/logger.js');
const { ScheduleView } = require('../../src/commands/setup/_ScheduleView.js');
const { CUSTOM_ID } = ScheduleView;
const { openTypeModal, openRecurringDetailModal } = require('./setupScheduleAddTypeModal.js');

class SetupScheduleHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === 'setup:sch') return this.some();
    if (id === CUSTOM_ID.PAGE_NEXT || id === CUSTOM_ID.PAGE_PREV) return this.some();
    if (id?.startsWith(CUSTOM_ID.DEL_PREFIX)) return this.some();
    if (id?.startsWith(CUSTOM_ID.EDIT_PREFIX)) return this.some();
    if (id === CUSTOM_ID.ADD) return this.some();
    return this.none();
  }

  async run(interaction) {
    const { customId, guild } = interaction;

    // Thêm lịch → mở Modal 1 (Loại)
    if (customId === CUSTOM_ID.ADD) {
      return openTypeModal(interaction);
    }

    // Sửa lịch → mở Modal chi tiết với prefill
    if (customId.startsWith(CUSTOM_ID.EDIT_PREFIX)) {
      const scheduleId = customId.slice(CUSTOM_ID.EDIT_PREFIX.length);
      const schedule = await db.getScheduledSessionById(scheduleId);
      if (!schedule) {
        await interaction.deferReply({ flags: require('discord.js').MessageFlags.Ephemeral });
        return interaction.editReply({ content: '❌ Không tìm thấy lịch.' });
      }
      const prefill = {
        dayOfWeek: schedule.day_of_week,
        hour: schedule.hour,
        minute: schedule.minute,
        sessionName: schedule.session_name,
        preCloseMinutes: schedule.pre_close_minutes,
      };
      return openRecurringDetailModal(interaction, prefill, scheduleId);
    }

    await interaction.deferUpdate();

    // Xoá 1 lịch
    if (customId.startsWith(CUSTOM_ID.DEL_PREFIX)) {
      const scheduleId = customId.slice(CUSTOM_ID.DEL_PREFIX.length);
      try {
        await db.deleteScheduledSession(scheduleId);
        log.info('SETUP_SCH', guild.id, 'Xoá lịch %s qua /setup', scheduleId);
      } catch (e) {
        log.error('SETUP_SCH', guild.id, 'deleteScheduledSession thất bại: %s', e.message);
      }
      const schedules = await db.getScheduledSessions(guild.id);
      const curPage = _extractPageFromEmbed(interaction);
      const view = ScheduleView.render({ schedules, page: curPage, guild });
      return interaction.editReply(view);
    }

    // Phân trang
    const schedules = await db.getScheduledSessions(guild.id);
    const curPage = _extractPageFromEmbed(interaction);

    let newPage = curPage;
    if (customId === CUSTOM_ID.PAGE_NEXT) newPage = curPage + 1;
    if (customId === CUSTOM_ID.PAGE_PREV) newPage = curPage - 1;

    const view = ScheduleView.render({ schedules, page: newPage, guild });
    return interaction.editReply(view);
  }
}

// Helper: lấy page hiện tại từ footer embed (parse số trang).
// Fallback về 0 nếu không parse được.
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
