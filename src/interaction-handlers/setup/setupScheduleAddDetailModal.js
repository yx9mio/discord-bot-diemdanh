// interaction-handlers/setup/setupScheduleAddDetailModal.js
// [FIX-DB] Thay db.js → scheduledService + configService
'use strict';
const { MessageFlags } = require('discord.js');
const {
  InteractionHandler, InteractionHandlerTypes,
} = require('@sapphire/framework');
const scheduledService = require('../../../services/scheduledService.js');
const configService    = require('../../../services/configService.js');
const log = require('../../../utils/logger.js');
const {
  CUSTOM_ID,
} = require('./setupScheduleAddTypeModal.js');

function parseGio(gioStr) {
  const m = /^(\d{1,2}):(\d{2})$/.exec((gioStr ?? '').trim());
  if (!m) return null;
  const hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function parsePreClose(val) {
  const n = parseInt(val ?? '30', 10);
  if (Number.isNaN(n) || n < 0 || n > 180) return 30;
  return n;
}

function parsePhutBu(openHour, openMinute, phutBuVal, dayOfWeek = 0) {
  const raw = parseInt(phutBuVal ?? '0', 10);
  const phutBu = Number.isNaN(raw) ? 0 : Math.max(0, Math.min(raw, 120));
  let closeMinute = openMinute + phutBu;
  let closeHour = openHour + Math.floor(closeMinute / 60);
  closeMinute = closeMinute % 60;
  let closeDow = dayOfWeek;
  if (closeHour >= 24) {
    closeHour = closeHour % 24;
    closeDow = (dayOfWeek + 1) % 7;
  }
  return { phutBu, closeHour, closeMinute, closeDow };
}

// Modal 2a: Lặp hàng tuần
const MODAL_RECURRING_ID = 'setup:sch:add:recurring:detail';
class SetupScheduleRecurringDetailHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }
  parse(interaction) {
    if (interaction.customId === MODAL_RECURRING_ID) return this.some();
    return this.none();
  }
  async run(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { guild } = interaction;

    const dowRaw   = interaction.fields.getTextInputValue('day_of_week').trim();
    const gioRaw   = interaction.fields.getTextInputValue('gio_mo').trim();
    const phutBuRaw = interaction.fields.getTextInputValue('phut_bu')?.trim() ?? '0';
    const preRaw   = interaction.fields.getTextInputValue('pre_close')?.trim() ?? '30';

    const dowMap = { cn:0,sun:0,t2:1,mon:1,t3:2,tue:2,t4:3,wed:3,t5:4,thu:4,t6:5,fri:5,t7:6,sat:6 };
    const dowKey = dowRaw.toLowerCase().replace(/\s/g, '');
    const dow = dowMap[dowKey] ?? parseInt(dowRaw, 10);
    if (Number.isNaN(dow) || dow < 0 || dow > 6) {
      return interaction.editReply({ content: '❌ Ngày trong tuần không hợp lệ. VD: t2, t3, t4, t5, t6, t7, cn hoặc 0-6.' });
    }

    const gio = parseGio(gioRaw);
    if (!gio) {
      return interaction.editReply({ content: '❌ Giờ mở không hợp lệ. Định dạng HH:MM (VD: 20:00).' });
    }

    const { phutBu, closeHour, closeMinute, closeDow } = parsePhutBu(gio.hour, gio.minute, phutBuRaw, dow);
    const preClose = parsePreClose(preRaw);

    const cfg = await configService.getGuildConfig(guild.id);
    const timezone = cfg?.timezone ?? 'Asia/Ho_Chi_Minh';

    const dowNames = ['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];

    let scheduleId;
    try {
      const rec = await scheduledService.createScheduledSession({
        guild_id: guild.id,
        type: 'recurring_weekly',
        day_of_week: dow,
        open_hour: gio.hour,
        open_minute: gio.minute,
        close_hour: closeHour,
        close_minute: closeMinute,
        close_day_of_week: closeDow,
        pre_close_minutes: preClose,
        timezone,
        is_active: true,
      });
      scheduleId = rec.id;
      log.info('SETUP_SCH', guild.id, 'Thêm lịch recurring #%s: %s %02d:%02d +%dm (preClose=%dm)',
        scheduleId, dowNames[dow], gio.hour, gio.minute, phutBu, preClose);
    } catch (e) {
      log.error('SETUP_SCH', guild.id, 'createScheduledSession thất bại: %s', e.message);
      return interaction.editReply({ content: '❌ Không thể thêm lịch, thử lại sau.' });
    }

    return interaction.editReply({
      content:
        `✅ Đã thêm lịch **#${scheduleId}** — Hàng tuần\n` +
        `📅 **${dowNames[dow]}** lúc **${String(gio.hour).padStart(2,'0')}:${String(gio.minute).padStart(2,'0')}**\n` +
        `⏱️ Phiên dài **${phutBu} phút** → đóng lúc **${String(closeHour).padStart(2,'0')}:${String(closeMinute).padStart(2,'0')}** (${dowNames[closeDow]})\n` +
        `🔔 Nhắc nhở trước **${preClose} phút**\n` +
        `🕐 Timezone: \`${timezone}\``,
    });
  }
}

// Modal 2b: Một lần (One-time)
const MODAL_ONETIME_ID = 'setup:sch:add:onetime:detail';
class SetupScheduleOneTimeDetailHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }
  parse(interaction) {
    if (interaction.customId === MODAL_ONETIME_ID) return this.some();
    return this.none();
  }
  async run(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { guild } = interaction;

    const ngayRaw  = interaction.fields.getTextInputValue('ngay').trim();
    const gioRaw   = interaction.fields.getTextInputValue('gio_mo').trim();
    const phutBuRaw = interaction.fields.getTextInputValue('phut_bu')?.trim() ?? '0';
    const preRaw   = interaction.fields.getTextInputValue('pre_close')?.trim() ?? '30';

    // Validate ngày DD/MM/YYYY hoặc YYYY-MM-DD
    let dateObj;
    const ddmm = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(ngayRaw);
    const iso  = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ngayRaw);
    if (ddmm) {
      dateObj = new Date(parseInt(ddmm[3],10), parseInt(ddmm[2],10)-1, parseInt(ddmm[1],10));
    } else if (iso) {
      dateObj = new Date(parseInt(iso[1],10), parseInt(iso[2],10)-1, parseInt(iso[3],10));
    } else {
      return interaction.editReply({ content: '❌ Ngày không hợp lệ. Định dạng DD/MM/YYYY hoặc YYYY-MM-DD.' });
    }
    if (isNaN(dateObj.getTime())) {
      return interaction.editReply({ content: '❌ Ngày không hợp lệ.' });
    }

    const gio = parseGio(gioRaw);
    if (!gio) {
      return interaction.editReply({ content: '❌ Giờ mở không hợp lệ. Định dạng HH:MM (VD: 20:00).' });
    }

    const dow = dateObj.getDay();
    const { phutBu, closeHour, closeMinute, closeDow } = parsePhutBu(gio.hour, gio.minute, phutBuRaw, dow);
    const preClose = parsePreClose(preRaw);

    const cfg = await configService.getGuildConfig(guild.id);
    const timezone = cfg?.timezone ?? 'Asia/Ho_Chi_Minh';

    // [BUG-2] scheduled_date phải là string ISO date 'YYYY-MM-DD' theo DB column
    const yyyy = dateObj.getFullYear();
    const mm   = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd   = String(dateObj.getDate()).padStart(2, '0');
    const scheduledDate = `${yyyy}-${mm}-${dd}`;

    let scheduleId;
    try {
      const rec = await scheduledService.createScheduledSession({
        guild_id: guild.id,
        type: 'one_time',
        scheduled_date: scheduledDate,
        open_hour: gio.hour,
        open_minute: gio.minute,
        close_hour: closeHour,
        close_minute: closeMinute,
        pre_close_minutes: preClose,
        timezone,
        is_active: true,
      });
      scheduleId = rec.id;
      log.info('SETUP_SCH', guild.id, 'Thêm lịch one-time #%s: %s %02d:%02d +%dm',
        scheduleId, scheduledDate, gio.hour, gio.minute, phutBu);
    } catch (e) {
      log.error('SETUP_SCH', guild.id, 'createScheduledSession one-time thất bại: %s', e.message);
      return interaction.editReply({ content: '❌ Không thể thêm lịch, thử lại sau.' });
    }

    const dowNames = ['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];
    return interaction.editReply({
      content:
        `✅ Đã thêm lịch **#${scheduleId}** — Một lần\n` +
        `📅 **${scheduledDate}** (${dowNames[dow]}) lúc **${String(gio.hour).padStart(2,'0')}:${String(gio.minute).padStart(2,'0')}**\n` +
        `⏱️ Phiên dài **${phutBu} phút** → đóng lúc **${String(closeHour).padStart(2,'0')}:${String(closeMinute).padStart(2,'0')}**\n` +
        `🔔 Nhắc nhở trước **${preClose} phút**\n` +
        `🕐 Timezone: \`${timezone}\``,
    });
  }
}

module.exports = {
  SetupScheduleRecurringDetailHandler,
  SetupScheduleOneTimeDetailHandler,
  MODAL_RECURRING_ID,
  MODAL_ONETIME_ID,
  parseGio,
  parsePreClose,
  parsePhutBu,
};
