// interaction-handlers/setup/setupScheduleAddDetailModal.js
// Handle Modal submits cho schedule add:
//   - setup:sch:add:detail:r   (Recurring: Thứ + Tên + Giờ + pre_close + phut_bu)
//   - setup:sch:add:detail:o   (One-time combined: DD/MM/YYYY + Giờ + Tên + pre_close + phut_bu)
//   - setup:sch:edit:r:<id>    (Sửa recurring)
//
// [BUG-A] Fix: cfg?.log_channel_id → cfg?.notification_channel_id (đúng column trong guild_configs)
// [BUG-B] Fix: one-time truyền đủ specificDate/Month/Year + schedule_type vào themLichCoDinh
// [BUG-2&3] Đã xoá: _otDateStore, DETAIL_O_A, TIME_O, _handleOneTimeDate, _handleOneTimeTime
'use strict';
const { MessageFlags } = require('discord.js');
const {
  InteractionHandler, InteractionHandlerTypes,
} = require('@sapphire/framework');
const db = require('../../db.js');
const log = require('../../utils/logger.js');
const {
  CUSTOM_ID,
} = require('./setupScheduleAddTypeModal.js');

// ── Helper: parse HH:MM thành { hour, minute } ────────────────────────────
function parseGio(gioStr) {
  const m = /^(\d{1,2}):(\d{2})$/.exec((gioStr ?? '').trim());
  if (!m) return null;
  const hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

// ── Helper: parse pre_close ────────────────────────────────────────────
function parsePreClose(val) {
  const n = parseInt(val ?? '30', 10);
  if (Number.isNaN(n) || n < 0 || n > 180) return 30;
  return n;
}

// ── Helper: parse phut_bu → closeHour/closeMinute ──────────────────────
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

// ── Helper: parse DD/MM/YYYY → { ngay, thang, nam } ──────────────────────
function parseNgayThangNam(str) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((str ?? '').trim());
  if (!m) return null;
  const ngay  = parseInt(m[1], 10);
  const thang = parseInt(m[2], 10);
  const nam   = parseInt(m[3], 10);
  if (ngay < 1 || ngay > 31 || thang < 1 || thang > 12) return null;
  return { ngay, thang, nam };
}

// [BUG-A] Lấy đúng notification_channel_id từ guild_configs
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

    // [BUG-A] Dùng notification_channel_id thay vì log_channel_id
    const cfg = await db.getGuildConfig(guildId);
    const channelId = _getChannelId(cfg);
    if (!channelId) {
      return interaction.editReply({
        content: '❌ Chưa cấu hình **Kênh thông báo**. Vào `/setup` → Cài đặt chung → Kênh thông báo để cài trước.',
      });
    }
    const close = parsePhutBu(gio.hour, gio.minute, phutBu, dayOfWeek);
    try {
      await db.themLichCoDinh(guildId, {
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

    // [BUG-A] Dùng notification_channel_id
    const cfg = await db.getGuildConfig(guildId);
    const channelId = _getChannelId(cfg);
    if (!channelId) {
      return interaction.editReply({
        content: '❌ Chưa cấu hình **Kênh thông báo**. Vào `/setup` → Cài đặt chung → Kênh thông báo để cài trước.',
      });
    }
    const close = parsePhutBu(gio.hour, gio.minute, phutBu, dayOfWeek);
    try {
      await db.suaLichCoDinh(guildId, scheduleId, {
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

  // [BUG-2&3] One-time combined: nhận DD/MM/YYYY + HH:MM + tên trong 1 modal
  // [BUG-B] Fix: schema scheduled_sessions không có schedule_type/specific_date —
  //         one-time được mô hình bằng day_of_week tính từ ngày thực + skip_until tương lai.
  //         Ghi chú ngày cụ thể vào session_name để phân biệt với recurring.
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

    // Validate ngày hợp lệ
    const date = new Date(nam, thang - 1, ngay);
    if (Number.isNaN(date.getTime()) || date.getDate() !== ngay) {
      return interaction.editReply({ content: `❌ Ngày ${ngay}/${thang}/${nam} không hợp lệ.` });
    }
    if (date.getTime() <= Date.now()) {
      return interaction.editReply({ content: `❌ Ngày ${ngay}/${thang}/${nam} đã qua. Vui lòng chọn ngày trong tương lai.` });
    }

    // [BUG-A] Dùng notification_channel_id
    const cfg = await db.getGuildConfig(guildId);
    const channelId = _getChannelId(cfg);
    if (!channelId) {
      return interaction.editReply({ content: '❌ Chưa cấu hình **Kênh thông báo**. Vào `/setup` → Cài đặt chung → Kênh thông báo.' });
    }

    // [BUG-B] scheduled_sessions không có cột schedule_type/specific_date.
    // Mô hình one-time: lưu theo day_of_week thực tế của ngày đó.
    // Dùng skip_until = ngày HÔM SAU buổi học để scheduler không lặp lại.
    // Tên lịch gắn "[ngay/thang]" để phân biệt trực quan.
    const dayOfWeek = date.getDay(); // 0=CN,1=T2,...,6=T7
    const close = parsePhutBu(gio.hour, gio.minute, phutBu, dayOfWeek);

    // skipUntil = ngày sau buổi học (scheduler dùng IS NULL OR skip_until < now)
    const skipAfter = new Date(date);
    skipAfter.setDate(skipAfter.getDate() + 1);
    skipAfter.setHours(gio.hour, gio.minute, 0, 0);
    const skipUntil = skipAfter.toISOString();

    // Tên hiển thị gắn ngày để phân biệt
    const displayName = `${sessionName} [${String(ngay).padStart(2,'0')}/${String(thang).padStart(2,'0')}]`;

    try {
      await db.themLichCoDinh(guildId, {
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
      // Lấy record vừa tạo để set skip_until
      const schedules = await db.getScheduledSessions(guildId);
      const newEntry = schedules
        .filter(s => s.session_name === displayName && s.day_of_week === dayOfWeek)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      if (newEntry) {
        await db.skipScheduledSession(newEntry.id, skipUntil);
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
