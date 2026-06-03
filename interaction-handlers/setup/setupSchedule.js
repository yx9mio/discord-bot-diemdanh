// interaction-handlers/setup/setupSchedule.js
// Handles:
//   - setup:sch (mở Schedule view trang 0)
//   - setup:sch:page:next / :prev (phân trang)
//   - setup:sch:del:<scheduleId> → xác nhận xoà
//   - setup:sch:del:yes:<scheduleId> / del:no:<scheduleId>
//   - setup:sch:add:r → openRecurringDetailModal (Button, không qua Modal 1)
//   - setup:sch:add:o → openOneTimeCombinedModal (Button, không qua Modal 1)
//   - setup:sch:edit:<id> → modal (routing theo schedule_type)
'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const db = require('../../db.js');
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
    // EDIT_PREFIX = 'setup:sch:edit:' — match cả recurring và one-time
    if (id?.startsWith(CUSTOM_ID.EDIT_PREFIX) &&
        !id.startsWith(CUSTOM_ID.DEL_PREFIX) &&
        !id.startsWith(CUSTOM_ID.PAGE_NEXT) &&
        !id.startsWith(CUSTOM_ID.PAGE_PREV)) return this.some();
    if (id === CUSTOM_ID.ADD_R || id === CUSTOM_ID.ADD_O) return this.some();
    return this.none();
  }

  async run(interaction) {
    const { customId, guild } = interaction;

    // [BUG-2&3] Thêm lịch hằng tuần → showModal từ Button (an toàn)
    if (customId === CUSTOM_ID.ADD_R) {
      return openRecurringDetailModal(interaction);
    }

    // [BUG-2&3] Thêm lịch một lần → showModal từ Button (an toàn)
    if (customId === CUSTOM_ID.ADD_O) {
      return openOneTimeCombinedModal(interaction);
    }

    // [BUG-1] Sửa lịch → query DB tối đa 1.5s, fallback to recurring
    if (customId.startsWith(CUSTOM_ID.EDIT_PREFIX)) {
      const scheduleId = customId.slice(CUSTOM_ID.EDIT_PREFIX.length);
      let scheduleType = null;
      try {
        const schedule = await Promise.race([
          db.getScheduledSessionById(scheduleId),
          new Promise(res => setTimeout(() => res(null), 1500)),
        ]);
        scheduleType = schedule?.schedule_type ?? null;
      } catch (e) {
        log.warn('SETUP_SCH_EDIT', guild?.id, 'getScheduledSessionById err: %s', e.message);
      }

      if (scheduleType === 'one_time') {
        // EDIT one-time: dùng combined modal với customId trỏ về edit:ot:submit handler
        return interaction.showModal(
          _buildOneTimeCombinedModal({ submitCustomId: `setup:sch:edit:ot:submit:${scheduleId}` }),
        );
      }
      // EDIT recurring (hoặc không xác định): modal không prefill
      return openRecurringDetailModal(interaction, {}, scheduleId);
    }

    // Xác nhận xoà
    if (customId.startsWith(CUSTOM_ID.DEL_CONFIRM)) {
      await interaction.deferUpdate();
      const scheduleId = customId.slice(CUSTOM_ID.DEL_CONFIRM.length);
      const schedule = await db.getScheduledSessionById(scheduleId);
      if (!schedule) {
        const schedules = await db.getScheduledSessions(guild.id);
        const curPage = _extractPageFromEmbed(interaction);
        return interaction.editReply(ScheduleView.render({ schedules, page: curPage, guild }));
      }
      try {
        await db.deleteScheduledSession(scheduleId);
        log.info('SETUP_SCH', guild.id, 'Xoà lịch %s', scheduleId);
      } catch (e) {
        log.error('SETUP_SCH', guild.id, 'deleteScheduledSession thất bại: %s', e.message);
      }
      const schedules = await db.getScheduledSessions(guild.id);
      const curPage = _extractPageFromEmbed(interaction);
      return interaction.editReply(ScheduleView.render({ schedules, page: curPage, guild }));
    }

    // Huỷ xoà
    if (customId.startsWith(CUSTOM_ID.DEL_CANCEL)) {
      await interaction.deferUpdate();
      const schedules = await db.getScheduledSessions(guild.id);
      const curPage = _extractPageFromEmbed(interaction);
      return interaction.editReply(ScheduleView.render({ schedules, page: curPage, guild }));
    }

    await interaction.deferUpdate();

    // Xoà 1 lịch → hỏi xác nhận
    if (customId.startsWith(CUSTOM_ID.DEL_PREFIX)) {
      const scheduleId = customId.slice(CUSTOM_ID.DEL_PREFIX.length);
      const schedule = await db.getScheduledSessionById(scheduleId);
      if (!schedule) {
        const schedules = await db.getScheduledSessions(guild.id);
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

    // Phân trang
    const schedules = await db.getScheduledSessions(guild.id);
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
