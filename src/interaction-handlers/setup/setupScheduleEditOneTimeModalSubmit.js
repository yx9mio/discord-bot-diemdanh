// src/interaction-handlers/setup/setupScheduleEditOneTimeModalSubmit.js
// Handles: setup:sch:edit:onetime:* (ModalSubmit) — lưu sửa lịch one-time
'use strict';
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const scheduledService = require('../../../services/scheduledService.js');
const log = require('../../../utils/logger.js');
const { parseGio, parsePreClose, parsePhutBu } = require('./setupScheduleAddDetailModal.js');

const EDIT_ONETIME_MODAL_PREFIX = 'setup:sch:edit:onetime:';
const DOW_NAMES = ['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];

class SetupScheduleEditOneTimeModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }
  parse(interaction) {
    if (interaction.customId.startsWith(EDIT_ONETIME_MODAL_PREFIX)) return this.some();
    return this.none();
  }
  async run(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { guild } = interaction;
    const scheduleId = interaction.customId.slice(EDIT_ONETIME_MODAL_PREFIX.length);
    const ngayRaw   = interaction.fields.getTextInputValue('ngay').trim();
    const gioRaw    = interaction.fields.getTextInputValue('gio_mo').trim();
    const phutBuRaw = interaction.fields.getTextInputValue('phut_bu')?.trim() ?? '0';
    const preRaw    = interaction.fields.getTextInputValue('pre_close')?.trim() ?? '30';
    let dateObj;
    const ddmm = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(ngayRaw);
    const iso  = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ngayRaw);
    if (ddmm) dateObj = new Date(parseInt(ddmm[3],10), parseInt(ddmm[2],10)-1, parseInt(ddmm[1],10));
    else if (iso) dateObj = new Date(parseInt(iso[1],10), parseInt(iso[2],10)-1, parseInt(iso[3],10));
    else return interaction.editReply({ content: '❌ Ngày không hợp lệ. Định dạng DD/MM/YYYY hoặc YYYY-MM-DD.' });
    if (isNaN(dateObj.getTime())) return interaction.editReply({ content: '❌ Ngày không hợp lệ.' });
    const gio = parseGio(gioRaw);
    if (!gio) return interaction.editReply({ content: '❌ Giờ mở không hợp lệ. Định dạng HH:MM.' });
    const dow = dateObj.getDay();
    const { phutBu, closeHour, closeMinute } = parsePhutBu(gio.hour, gio.minute, phutBuRaw, dow);
    const preClose = parsePreClose(preRaw);
    const yyyy = dateObj.getFullYear(), mm = String(dateObj.getMonth() + 1).padStart(2, '0'), dd = String(dateObj.getDate()).padStart(2, '0');
    const scheduledDate = `${yyyy}-${mm}-${dd}`;
    try {
      await scheduledService.updateScheduledSession(guild.id, scheduleId, {
        scheduled_date: scheduledDate, open_hour: gio.hour, open_minute: gio.minute,
        close_hour: closeHour, close_minute: closeMinute, pre_close_minutes: preClose,
      });
      log.info('SETUP_SCH_EDIT', guild.id, 'Sửa one-time #%s → %s %02d:%02d +%dm', scheduleId, scheduledDate, gio.hour, gio.minute, phutBu);
    } catch (e) {
      log.error('SETUP_SCH_EDIT', guild.id, 'updateScheduledSession #%s thất bại: %s', scheduleId, e.message);
      return interaction.editReply({ content: '❌ Không thể cập nhật lịch, thử lại sau.' });
    }
    return interaction.editReply({
      content:
        `✅ Đã cập nhật lịch **#${scheduleId}**\n` +
        `📅 **${scheduledDate}** (${DOW_NAMES[dow]}) lúc **${String(gio.hour).padStart(2,'0')}:${String(gio.minute).padStart(2,'0')}**\n` +
        `⏱️ Phiên dài **${phutBu} phút** → đóng lúc **${String(closeHour).padStart(2,'0')}:${String(closeMinute).padStart(2,'0')}**\n` +
        `🔔 Nhắc nhở trước **${preClose} phút**`,
    });
  }
}

module.exports = { SetupScheduleEditOneTimeModalHandler };
