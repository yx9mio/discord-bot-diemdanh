// src/interaction-handlers/setup/setupScheduleAddDetailModal.js
// Handles: setup:sch:add:recurring:detail + setup:sch:add:onetime:detail (ModalSubmit)
// [SYNC] Đọc đúng field IDs từ modal — modal có day_of_week, gio_mo, phut_bu, pre_close
// [FIX-PATH] ../../../ → ../../../../
'use strict';
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const scheduledService = require('../../../services/scheduledService.js');
const configService    = require('../../../services/configService.js');
const log = require('../../../utils/logger.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { replyErrEdit } = require('../../../utils/embeds.js');

const MODAL_RECURRING_ID = 'setup:sch:add:recurring:detail';
const MODAL_ONETIME_ID   = 'setup:sch:add:onetime:detail';

const DAY_MAP = { t2:1, t3:2, t4:3, t5:4, t6:5, t7:6, cn:0 };

function parseDay(v) {
  const n = parseInt(v, 10);
  if (!isNaN(n)) return n - 1;
  const mapped = DAY_MAP[v.toLowerCase()];
  if (mapped) return mapped;
  const eng = { mon:1, tue:2, wed:3, thu:4, fri:5, sat:6, sun:0 };
  return eng[v.toLowerCase()] ?? null;
}

class SetupScheduleAddDetailModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId === MODAL_RECURRING_ID || interaction.customId === MODAL_ONETIME_ID) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { ok } = await requireAdmin(interaction, { deferred: true, context: 'thêm lịch' });
    if (!ok) return;
    const { guild, customId } = interaction;

    try {
      const cfg = await configService.getGuildConfig(guild.id);
      const tz = cfg?.timezone ?? 'Asia/Ho_Chi_Minh';

      if (customId === MODAL_RECURRING_ID) {
        const day_raw   = interaction.fields.getTextInputValue('day_of_week').trim();
        const gio_mo    = interaction.fields.getTextInputValue('gio_mo').trim();
        const phut_bu   = interaction.fields.getTextInputValue('phut_bu')?.trim();
        const pre_close = interaction.fields.getTextInputValue('pre_close')?.trim();

        const dayOfWeek = parseDay(day_raw);
        if (!dayOfWeek) throw new Error(`Ngày không hợp lệ: "${day_raw}"`);

        const [hour, minute] = gio_mo.split(':').map(Number);
        if (isNaN(hour) || isNaN(minute)) throw new Error(`Giờ không hợp lệ: "${gio_mo}"`);

        const durationMin = phut_bu ? parseInt(phut_bu, 10) : 0;
        let closeHour = null, closeMinute = null;
        if (durationMin > 0) {
          const total = hour * 60 + minute + durationMin;
          closeHour = Math.floor(total / 60) % 24;
          closeMinute = total % 60;
        }

        const reminderMin = pre_close ? parseInt(pre_close, 10) : 30;

        await scheduledService.addRecurringSession(guild.id, {
          thu: dayOfWeek, gio_bat_dau: `${hour}:${String(minute).padStart(2, '0')}`,
          gio_ket_thuc: closeHour != null ? `${closeHour}:${String(closeMinute).padStart(2, '0')}` : null,
          ten: 'Điểm danh', timezone: tz, pre_close_minutes: reminderMin,
        });
      } else {
        const ngay       = interaction.fields.getTextInputValue('ngay').trim();
        const gio_mo     = interaction.fields.getTextInputValue('gio_mo').trim();
        const phut_bu    = interaction.fields.getTextInputValue('phut_bu')?.trim();
        const pre_close  = interaction.fields.getTextInputValue('pre_close')?.trim();

        const reminderMin = pre_close ? parseInt(pre_close, 10) : 30;

        const [hour, minute] = gio_mo.split(':').map(Number);
        if (isNaN(hour) || isNaN(minute)) throw new Error(`Giờ không hợp lệ: "${gio_mo}"`);

        const durationMin = phut_bu ? parseInt(phut_bu, 10) : 0;
        let closeHour = null, closeMinute = null;
        if (durationMin > 0) {
          const total = hour * 60 + minute + durationMin;
          closeHour = Math.floor(total / 60) % 24;
          closeMinute = total % 60;
        }

        await scheduledService.addOnetimeSession(guild.id, {
          ngay,
          gio_bat_dau: `${hour}:${String(minute).padStart(2, '0')}`,
          gio_ket_thuc: closeHour != null ? `${closeHour}:${String(closeMinute).padStart(2, '0')}` : null,
          ten: 'Điểm danh', timezone: tz, pre_close_minutes: reminderMin,
        });
      }

      const { ScheduleView } = require('../../commands/setup/_views/_ScheduleView.js');
      const sessions = await scheduledService.getScheduledSessions(guild.id);
      await interaction.message?.edit(ScheduleView.render({ schedules: sessions, guild, page: 0 })).catch(() => null);
      return interaction.editReply({ content: '✅ Đã thêm lịch.' });
    } catch (e) {
      log.error('SCH_ADD_DETAIL', guild.id, 'Lỗi thêm lịch: %s', e.message);
      return interaction.editReply(replyErrEdit(`Không thể thêm lịch: ${e.message}`));
    }
  }
}

module.exports = { SetupScheduleAddDetailModalHandler, MODAL_RECURRING_ID, MODAL_ONETIME_ID };
