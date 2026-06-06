// src/interaction-handlers/setup/setupScheduleEditOneTimeModal.js
// Handles: setup:sch:edit:* (Button) — mở modal sửa lịch one-time
'use strict';
const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const scheduledService = require('../../../services/scheduledService.js');
const configService    = require('../../../services/configService.js');
const log = require('../../../utils/logger.js');
const { parseGio, parsePreClose, parsePhutBu } = require('./setupScheduleAddDetailModal.js');
const { requireAdmin } = require('../../../utils/permissions.js');

const EDIT_BTN_PREFIX           = 'setup:sch:edit:';
const EDIT_ONETIME_MODAL_PREFIX = 'setup:sch:edit:onetime:';

class SetupScheduleEditBtnHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }
  parse(interaction) {
    const id = interaction.customId;
    if (id.startsWith(EDIT_BTN_PREFIX) && !id.startsWith(EDIT_ONETIME_MODAL_PREFIX)) return this.some();
    return this.none();
  }
  async run(interaction) {
    // [BUG-8] requireAdmin — ngăn user thường mở modal sửa lịch
    const { ok } = await requireAdmin(interaction, { context: 'sửa lịch', deferred: false });
    if (!ok) return;
    const scheduleId = interaction.customId.slice(EDIT_BTN_PREFIX.length);
    const { guild } = interaction;
    let schedule;
    try { schedule = await scheduledService.getScheduledSession(guild.id, scheduleId); } catch (e) {
      log.warn('SETUP_SCH_EDIT', guild.id, 'getScheduledSession #%s thất bại: %s', scheduleId, e.message);
    }
    if (!schedule) return interaction.reply({ content: `❌ Không tìm thấy lịch #${scheduleId}.`, flags: MessageFlags.Ephemeral });
    if (schedule.type !== 'one_time') return interaction.reply({ content: '⚠️ Hiện tại chỉ hỗ trợ sửa lịch **một lần** (one-time). Lịch hàng tuần vui lòng xóa và tạo lại.', flags: MessageFlags.Ephemeral });
    const cfg = await configService.getGuildConfig(guild.id).catch(() => null);
    const tz = cfg?.timezone ?? 'Asia/Ho_Chi_Minh';
    const ngayVal   = schedule.scheduled_date ?? '';
    const gioVal    = schedule.open_hour != null ? `${String(schedule.open_hour).padStart(2,'0')}:${String(schedule.open_minute ?? 0).padStart(2,'0')}` : '';
    const phutBuVal = schedule.close_hour != null && schedule.open_hour != null ? String((schedule.close_hour - schedule.open_hour) * 60 + ((schedule.close_minute ?? 0) - (schedule.open_minute ?? 0))) : '0';
    const preVal    = String(schedule.pre_close_minutes ?? 30);
    const modal = new ModalBuilder()
      .setCustomId(EDIT_ONETIME_MODAL_PREFIX + scheduleId)
      .setTitle(`Sửa lịch #${scheduleId} (${tz})`)
      .addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ngay').setLabel('Ngày (DD/MM/YYYY hoặc YYYY-MM-DD)').setStyle(TextInputStyle.Short).setValue(ngayVal).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('gio_mo').setLabel('Giờ mở (HH:MM)').setStyle(TextInputStyle.Short).setValue(gioVal).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('phut_bu').setLabel('Phiên dài (phút, 0 = không tự đóng)').setStyle(TextInputStyle.Short).setValue(phutBuVal).setRequired(false)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pre_close').setLabel('Nhắc nhở trước (phút, 0 = tắt)').setStyle(TextInputStyle.Short).setValue(preVal).setRequired(false)),
      );
    return interaction.showModal(modal);
  }
}

class SetupScheduleEditOnetimeModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }
  parse(interaction) {
    if (interaction.customId.startsWith(EDIT_ONETIME_MODAL_PREFIX)) return this.some();
    return this.none();
  }
  async run(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    // [BUG-8] requireAdmin — ngăn user thường submit modal sửa lịch trực tiếp
    const { ok } = await requireAdmin(interaction, { context: 'lưu sửa lịch một lần', deferred: true });
    if (!ok) return;
    const { guild } = interaction;
    const scheduleId = interaction.customId.slice(EDIT_ONETIME_MODAL_PREFIX.length);
    const ngayRaw   = interaction.fields.getTextInputValue('ngay').trim();
    const gioRaw    = interaction.fields.getTextInputValue('gio_mo').trim();
    const phutBuRaw = interaction.fields.getTextInputValue('phut_bu')?.trim() ?? '0';
    const preRaw    = interaction.fields.getTextInputValue('pre_close')?.trim() ?? '30';
    // Normalize date DD/MM/YYYY → YYYY-MM-DD
    let dateRaw = ngayRaw;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(ngayRaw)) {
      const [dd, mm, yyyy] = ngayRaw.split('/');
      dateRaw = `${yyyy}-${mm}-${dd}`;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
      return interaction.editReply({ content: '❌ Ngày không hợp lệ. Định dạng DD/MM/YYYY hoặc YYYY-MM-DD.' });
    }
    const gio = parseGio(gioRaw);
    if (!gio) return interaction.editReply({ content: '❌ Giờ mở không hợp lệ. Định dạng HH:MM (VD: 20:00).' });
    const [yyyy, mm, dd] = dateRaw.split('-').map(Number);
    const targetDate = new Date(yyyy, mm - 1, dd, gio.hour, gio.minute);
    if (targetDate <= new Date()) {
      return interaction.editReply({ content: '❌ Ngày/giờ đã qua. Vui lòng chọn thời điểm trong tương lai.' });
    }
    const dow = targetDate.getDay();
    const { phutBu, closeHour, closeMinute, closeDow } = parsePhutBu(gio.hour, gio.minute, phutBuRaw, dow);
    const preClose = parsePreClose(preRaw);
    if (phutBu > 0 && preClose >= phutBu) {
      return interaction.editReply({ content: `❌ Thời gian nhắc trước (**${preClose} phút**) phải nhỏ hơn thời lượng phiên (**${phutBu} phút**).` });
    }
    try {
      await scheduledService.updateScheduledSession(guild.id, scheduleId, {
        scheduled_date:    dateRaw,
        day_of_week:       dow,
        open_hour:         gio.hour,
        open_minute:       gio.minute,
        close_day_of_week: closeDow,
        close_hour:        closeHour,
        close_minute:      closeMinute,
        pre_close_minutes: preClose,
      });
    } catch (e) {
      log.error('SETUP_SCH_EDIT_ONETIME', guild.id, 'updateScheduledSession #%s thất bại: %s', scheduleId, e.message);
      return interaction.editReply({ content: '❌ Không thể lưu thay đổi, thử lại sau.' });
    }
    log.info('SETUP_SCH_EDIT_ONETIME', guild.id, 'Đã sửa lịch #%s', scheduleId);
    return interaction.editReply({
      content: [
        `✅ Đã cập nhật lịch \`#${scheduleId}\``,
        `📅 Ngày: \`${dateRaw}\` | 🕐 Mở: \`${String(gio.hour).padStart(2,'0')}:${String(gio.minute).padStart(2,'0')}\` | ⏱️ Đóng sau **${phutBu} phút**`,
        `🔔 Nhắc trước **${preClose} phút**`,
      ].join('\n'),
    });
  }
}

module.exports = { SetupScheduleEditBtnHandler, SetupScheduleEditOnetimeModalHandler };
