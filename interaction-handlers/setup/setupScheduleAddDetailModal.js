// interaction-handlers/setup/setupScheduleAddDetailModal.js
// [FIX-DB] Thay db.js → scheduledService + configService
'use strict';
const { MessageFlags } = require('discord.js');
const {
  InteractionHandler, InteractionHandlerTypes,
} = require('@sapphire/framework');
const scheduledService = require('../../services/scheduledService.js');
const configService    = require('../../services/configService.js');
const log = require('../../utils/logger.js');
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
  if (!phutBuVal || phutBuVal === 'none') return { closeHour: null, closeMinute: null, closeDayOfWeek: null };
  const offset = parseInt(phutBuVal, 10);
  if (Number.isNaN(offset)) return { closeHour: null, closeMinute: null, closeDayOfWeek: null };
  const totalMin = openHour * 60 + openMinute + offset;
  const daysOffset = Math.floor(totalMin / (24 * 60));
  const closeDayOfWeek = (dayOfWeek + daysOffset) % 7;
  const closeHour = Math.floor((totalMin % (24 * 60)) / 60);
  const closeMinute = totalMin % 60;
  return { closeDayOfWeek, closeHour, closeMinute };
}

function parseNgayThangNam(str) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((str ?? '').trim());
  if (!m) return null;
  const ngay  = parseInt(m[1], 10);
  const thang = parseInt(m[2], 10);
  const nam   = parseInt(m[3], 10);
  if (ngay < 1 || ngay > 31 || thang < 1 || thang > 12) return null;
  return { ngay, thang, nam };
}

function _getChannelId(cfg) {
  return cfg?.notification_channel_id ?? null;
}

class SetupScheduleAddDetailModal extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === CUSTOM_ID.DETAIL_R) return this.some();
    if (id === CUSTOM_ID.DETAIL_O) return this.some();
    if (id?.startsWith('setup:sch:edit:r:')) return this.some();
    return this.none();
  }

  run(interaction) {
    const id = interaction.customId;
    if (id === CUSTOM_ID.DETAIL_R) {
      return this._handleRecurring(interaction);
    }
    if (id?.startsWith('setup:sch:edit:r:')) {
      return this._handleEditRecurring(interaction);
    }
    if (id === CUSTOM_ID.DETAIL_O) {
      return this._handleOneTimeCombined(interaction);
    }
  }

  async _handleRecurring(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const guildId = interaction.guildId;
    const dayOfWeek = parseInt(interaction.fields.getTextInputValue('thu').trim(), 10);
    const sessionName = interaction.fields.getTextInputValue('ten').trim();
    const gio = parseGio(interaction.fields.getTextInputValue('gio'));
    if (!gio) {
      return interaction.editReply({ content: '❌ Giờ mở không hợp lệ. Dùng định dạng HH:MM (vd: 20:00).' });
    }
    const preClose = parsePreClose(interaction.fields.getTextInputValue('pre_close').trim());
    const phutBu   = interaction.fields.getTextInputValue('phut_bu').trim() || 'none';

    const cfg = await configService.getGuildConfig(guildId);
    const channelId = _getChannelId(cfg);
    if (!channelId) {
      return interaction.editReply({
        content: '❌ Chưa cấu hình **Kênh thông báo**. Vào `/setup` → Cài đặt chung → Kênh thông báo để cài trước.',
      });
    }
    const close = parsePhutBu(gio.hour, gio.minute, phutBu, dayOfWeek);
    try {
      await scheduledService.themLichCoDinh(guildId, {
        dayOfWeek,
        hour: gio.hour,
        minute: gio.minute,
        sessionName,
        preCloseMinutes: preClose,
        closeDayOfWeek: close.closeDayOfWeek,
        closeHour:      close.closeHour,
        closeMinute:    close.closeMinute,
        channelId,
      });
    } catch (e) {
      log.error('SETUP_SCH_ADD', guildId, 'themLichCoDinh thất bại: %s', e.message);
      return interaction.editReply({ content: `❌ Không thể lưu lịch: ${e.message}` });
    }
    return interaction.editReply({
      content: `✅ Đã thêm lịch **${sessionName}** — hằng tuần vào lúc **${String(gio.hour).padStart(2,'0')}:${String(gio.minute).padStart(2,'0')}** (đóng DD trước ${preClose}p).`,
    });
  }

  async _handleEditRecurring(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const scheduleId = interaction.customId.slice('setup:sch:edit:r:'.length);
    const guildId = interaction.guildId;
    const dayOfWeek = parseInt(interaction.fields.getTextInputValue('thu').trim(), 10);
    const sessionName = interaction.fields.getTextInputValue('ten').trim();
    const gio = parseGio(interaction.fields.getTextInputValue('gio'));
    if (!gio) {
      return interaction.editReply({ content: '❌ Giờ mở không hợp lệ. Dùng định dạng HH:MM (vd: 20:00).' });
    }
    const preClose = parsePreClose(interaction.fields.getTextInputValue('pre_close').trim());
    const phutBu   = interaction.fields.getTextInputValue('phut_bu').trim() || 'none';

    const cfg = await configService.getGuildConfig(guildId);
    const channelId = _getChannelId(cfg);
    if (!channelId) {
      return interaction.editReply({
        content: '❌ Chưa cấu hình **Kênh thông báo**. Vào `/setup` → Cài đặt chung → Kênh thông báo để cài trước.',
      });
    }
    const close = parsePhutBu(gio.hour, gio.minute, phutBu, dayOfWeek);
    try {
      await scheduledService.suaLichCoDinh(guildId, scheduleId, {
        dayOfWeek,
        hour: gio.hour,
        minute: gio.minute,
        sessionName,
        preCloseMinutes: preClose,
        closeDayOfWeek: close.closeDayOfWeek,
        closeHour:      close.closeHour,
        closeMinute:    close.closeMinute,
        channelId,
      });
    } catch (e) {
      log.error('SETUP_SCH_EDIT', guildId, 'suaLichCoDinh thất bại: %s', e.message);
      return interaction.editReply({ content: `❌ Không thể sửa lịch: ${e.message}` });
    }
    return interaction.editReply({
      content: `✅ Đã sửa lịch **${sessionName}** — hằng tuần vào lúc **${String(gio.hour).padStart(2,'0')}:${String(gio.minute).padStart(2,'0')}** (đóng DD trước ${preClose}p).`,
    });
  }

  async _handleOneTimeCombined(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const guildId = interaction.guildId;

    const parsed = parseNgayThangNam(interaction.fields.getTextInputValue('ngay_thang_nam'));
    if (!parsed) {
      return interaction.editReply({ content: '❌ Ngày không hợp lệ. Dùng định dạng DD/MM/YYYY (vd: 15/06/2026).' });
    }
    const { ngay, thang, nam } = parsed;

    const sessionName = interaction.fields.getTextInputValue('ten').trim();
    const gio = parseGio(interaction.fields.getTextInputValue('gio'));
    if (!gio) {
      return interaction.editReply({ content: '❌ Giờ mở không hợp lệ. Dùng định dạng HH:MM (vd: 20:00).' });
    }
    const preClose = parsePreClose(interaction.fields.getTextInputValue('pre_close').trim());
    const phutBu   = interaction.fields.getTextInputValue('phut_bu').trim() || 'none';

    const date = new Date(nam, thang - 1, ngay);
    if (Number.isNaN(date.getTime()) || date.getDate() !== ngay) {
      return interaction.editReply({ content: `❌ Ngày ${ngay}/${thang}/${nam} không hợp lệ.` });
    }
    if (date.getTime() <= Date.now()) {
      return interaction.editReply({ content: `❌ Ngày ${ngay}/${thang}/${nam} đã qua. Vui lòng chọn ngày trong tương lai.` });
    }

    const cfg = await configService.getGuildConfig(guildId);
    const channelId = _getChannelId(cfg);
    if (!channelId) {
      return interaction.editReply({ content: '❌ Chưa cấu hình **Kênh thông báo**. Vào `/setup` → Cài đặt chung → Kênh thông báo.' });
    }

    const dayOfWeek = date.getDay();
    const close = parsePhutBu(gio.hour, gio.minute, phutBu, dayOfWeek);

    const skipAfter = new Date(date);
    skipAfter.setDate(skipAfter.getDate() + 1);
    skipAfter.setHours(gio.hour, gio.minute, 0, 0);
    const skipUntil = skipAfter.toISOString();

    const displayName = `${sessionName} [${String(ngay).padStart(2,'0')}/${String(thang).padStart(2,'0')}]`;

    try {
      await scheduledService.themLichCoDinh(guildId, {
        dayOfWeek,
        hour: gio.hour,
        minute: gio.minute,
        sessionName: displayName,
        preCloseMinutes: preClose,
        closeDayOfWeek: close.closeDayOfWeek,
        closeHour:      close.closeHour,
        closeMinute:    close.closeMinute,
        channelId,
      });
      const schedules = await scheduledService.getScheduledSessions(guildId);
      const newEntry = schedules
        .filter(s => s.session_name === displayName && s.day_of_week === dayOfWeek)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      if (newEntry) {
        await scheduledService.skipScheduledSession(newEntry.id, skipUntil);
      }
    } catch (e) {
      log.error('SETUP_SCH_ADD', guildId, 'themLichCoDinh (one_time) thất bại: %s', e.message);
      return interaction.editReply({ content: `❌ Không thể lưu lịch: ${e.message}` });
    }
    return interaction.editReply({
      content: `✅ Đã thêm lịch một lần **${displayName}** — ${ngay}/${thang}/${nam} lúc **${String(gio.hour).padStart(2,'0')}:${String(gio.minute).padStart(2,'0')}** (đóng DD trước ${preClose}p).`,
    });
  }
}

module.exports = {
  SetupScheduleAddDetailModal,
  parseGio,
  parsePreClose,
  parsePhutBu,
};
