'use strict';
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const scheduledService = require('../../../services/scheduledService.js');
const configService    = require('../../../services/configService.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { replyErrEdit } = require('../../../utils/embeds.js');
const log = require('../../../utils/logger.js');

const EDIT_ONETIME_PREFIX    = 'setup:sch:edit:onetime:';
const EDIT_RECURRING_PREFIX  = 'setup:sch:edit:recurring:';

const DAY_MAP = { t2:1, t3:2, t4:3, t5:4, t6:5, t7:6, cn:0 };

function parseDay(v) {
  const n = parseInt(v, 10);
  if (!isNaN(n)) return n - 1;
  const mapped = DAY_MAP[v.toLowerCase()];
  if (mapped) return mapped;
  const eng = { mon:1, tue:2, wed:3, thu:4, fri:5, sat:6, sun:0 };
  return eng[v.toLowerCase()] ?? null;
}

class SetupScheduleEditOneTimeModalSubmitHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId.startsWith(EDIT_ONETIME_PREFIX)) return this.some();
    if (interaction.customId.startsWith(EDIT_RECURRING_PREFIX)) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { ok } = await requireAdmin(interaction, { context: 'sửa lịch', deferred: true });
    if (!ok) return;

    const { guild, customId } = interaction;
    const isRecurring = customId.startsWith(EDIT_RECURRING_PREFIX);
    const scheduleId = customId.slice(isRecurring ? EDIT_RECURRING_PREFIX.length : EDIT_ONETIME_PREFIX.length);

    try {
      const cfg = await configService.getGuildConfig(guild.id);
      const tz = cfg?.timezone ?? 'Asia/Ho_Chi_Minh';

      const gioMo   = interaction.fields.getTextInputValue('gio_mo').trim();
      const phutBu  = interaction.fields.getTextInputValue('phut_bu')?.trim() || '0';
      const ten     = interaction.fields.getTextInputValue('ten')?.trim() ?? '';

      if (!gioMo) return interaction.editReply(replyErrEdit('Giờ mở không được để trống.'));

      const [h, m] = gioMo.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return interaction.editReply(replyErrEdit('Giờ mở không hợp lệ (HH:mm).'));

      const durationMin = parseInt(phutBu, 10) || 0;
      let closeHour = null, closeMinute = null;
      if (durationMin > 0) {
        const total = h * 60 + m + durationMin;
        closeHour = Math.floor(total / 60) % 24;
        closeMinute = total % 60;
      }

      const basePayload = {
        hour: h,
        minute: m,
        close_hour: closeHour,
        close_minute: closeMinute,
        session_name: ten || 'Điểm danh',
      };

      if (isRecurring) {
        const thuRaw = interaction.fields.getTextInputValue('day_of_week').trim();
        const dayOfWeek = parseDay(thuRaw);
        if (!dayOfWeek) return interaction.editReply(replyErrEdit(`Thứ không hợp lệ: "${thuRaw}"`));
        await scheduledService.updateScheduledSession(guild.id, scheduleId, {
          ...basePayload,
          day_of_week: dayOfWeek,
        });
      } else {
        const ngay = interaction.fields.getTextInputValue('ngay').trim();
        if (!ngay) return interaction.editReply(replyErrEdit('Ngày không được để trống.'));
        await scheduledService.updateScheduledSession(guild.id, scheduleId, {
          ...basePayload,
          scheduled_date: ngay,
        });
      }

      const { ScheduleView } = require('../../commands/setup/_views/_ScheduleView.js');
      const sessions = await scheduledService.getScheduledSessions(guild.id);
      await interaction.message?.edit(ScheduleView.render({ schedules: sessions, guild, page: 0 })).catch(() => null);
      return interaction.editReply({ content: '✅ Đã cập nhật lịch.' });
    } catch (e) {
      log.error('SCH_EDIT_SUBMIT', guild.id, 'Lỗi lưu sửa %s: %s', scheduleId, e.message);
      return interaction.editReply(replyErrEdit(`Không thể lưu thay đổi: ${e.message}`));
    }
  }
}

module.exports = { SetupScheduleEditOneTimeModalSubmitHandler };
