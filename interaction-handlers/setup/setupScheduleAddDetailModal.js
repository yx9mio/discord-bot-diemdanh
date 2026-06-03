// interaction-handlers/setup/setupScheduleAddDetailModal.js
// Handle Modal 2/3 submits cho schedule add:
//   - setup:sch:add:detail:r  (Recurring: Thứ + Tên + Giờ + pre_close + phut_bu)
//   - setup:sch:add:detail:o:a (One-time: Ngày + Tháng + Năm) → mở Modal 2b
//   - setup:sch:add:time:o     (One-time: Tên + Giờ + pre_close + phut_bu)
//
// Validate + parse + lưu DB. Kênh lấy từ guild_configs.log_channel_id.
'use strict';
const { MessageFlags } = require('discord.js');
const {
  InteractionHandler, InteractionHandlerTypes,
} = require('@sapphire/framework');
const db = require('../../db.js');
const log = require('../../utils/logger.js');
const { ScheduleView: _ScheduleView } = require('../../src/commands/setup/_ScheduleView.js');
const { HomeView } = require('../../src/commands/setup/_HomeView.js');
const {
  CUSTOM_ID,
  openOneTimeTimeModal,
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

// Temporary in-memory store for one-time date across modals (interaction token → {ngay,thang,nam})
const _otDateStore = new Map();

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

class SetupScheduleAddDetailModal extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === CUSTOM_ID.DETAIL_R) return this.some();
    if (id === CUSTOM_ID.DETAIL_O_A) return this.some();
    if (id === CUSTOM_ID.TIME_O) return this.some();
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
    if (id === CUSTOM_ID.DETAIL_O_A) {
      return this._handleOneTimeDate(interaction);
    }
    if (id === CUSTOM_ID.TIME_O) {
      return this._handleOneTimeTime(interaction);
    }
  }

  async _handleRecurring(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const guildId = interaction.guildId;
    const dayOfWeek = parseInt(interaction.fields.getStringSelectValues('thu')?.[0] ?? '0', 10);
    const sessionName = interaction.fields.getTextInputValue('ten').trim();
    const gio = parseGio(interaction.fields.getTextInputValue('gio'));
    if (!gio) {
      return interaction.editReply({ content: '❌ Giờ mở không hợp lệ. Dùng định dạng HH:MM (vd: 20:00).' });
    }
    const preClose = parsePreClose(interaction.fields.getStringSelectValues('pre_close')?.[0]);
    const phutBu   = interaction.fields.getStringSelectValues('phut_bu')?.[0];

    const cfg = await db.getGuildConfig(guildId);
    const channelId = cfg?.log_channel_id ?? cfg?.channel_id;
    if (!channelId) {
      return interaction.editReply({
        content: '❌ Chưa cấu hình **Kênh log**. Vào `/setup` → Cài đặt chung → Kênh log để cài trước.',
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
      return interaction.editReply({ content: '❌ Không thể lưu lịch, thử lại sau.' });
    }
    return interaction.editReply({
      content: `✅ Đã thêm lịch **${sessionName}** — hằng tuần vào lúc **${String(gio.hour).padStart(2,'0')}:${String(gio.minute).padStart(2,'0')}** (đóng DD trước ${preClose}p).`,
    });
  }

  async _handleEditRecurring(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const scheduleId = interaction.customId.slice('setup:sch:edit:r:'.length);
    const guildId = interaction.guildId;
    const dayOfWeek = parseInt(interaction.fields.getStringSelectValues('thu')?.[0] ?? '0', 10);
    const sessionName = interaction.fields.getTextInputValue('ten').trim();
    const gio = parseGio(interaction.fields.getTextInputValue('gio'));
    if (!gio) {
      return interaction.editReply({ content: '❌ Giờ mở không hợp lệ. Dùng định dạng HH:MM (vd: 20:00).' });
    }
    const preClose = parsePreClose(interaction.fields.getStringSelectValues('pre_close')?.[0]);
    const phutBu   = interaction.fields.getStringSelectValues('phut_bu')?.[0];
    const cfg = await db.getGuildConfig(guildId);
    const channelId = cfg?.log_channel_id ?? cfg?.channel_id;
    if (!channelId) {
      return interaction.editReply({
        content: '❌ Chưa cấu hình **Kênh log**. Vào `/setup` → Cài đặt chung → Kênh log để cài trước.',
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
      return interaction.editReply({ content: '❌ Không thể sửa lịch, thử lại sau.' });
    }
    return interaction.editReply({
      content: `✅ Đã sửa lịch **${sessionName}** — hằng tuần vào lúc **${String(gio.hour).padStart(2,'0')}:${String(gio.minute).padStart(2,'0')}** (đóng DD trước ${preClose}p).`,
    });
  }

  _handleOneTimeDate(interaction) {
    const ngay  = parseInt(interaction.fields.getStringSelectValues('ngay')?.[0] ?? '0', 10);
    const thang = parseInt(interaction.fields.getStringSelectValues('thang')?.[0] ?? '0', 10);
    const nam   = parseInt(interaction.fields.getStringSelectValues('nam')?.[0] ?? '0', 10);
    if (!ngay || !thang || !nam) {
      return interaction.reply({ content: '❌ Thiếu ngày/tháng/năm.', flags: MessageFlags.Ephemeral });
    }
    _otDateStore.set(interaction.token, { ngay, thang, nam });
    setTimeout(() => _otDateStore.delete(interaction.token), 15 * 60 * 1000);
    return openOneTimeTimeModal(interaction);
  }

  async _handleOneTimeTime(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const guildId = interaction.guildId;
    const stored = _otDateStore.get(interaction.token);
    _otDateStore.delete(interaction.token);
    if (!stored) {
      return interaction.editReply({ content: '❌ Hết hạn chọn ngày. Bấm lại "Thêm lịch" và chọn đầy đủ.' });
    }
    const { ngay, thang, nam } = stored;
    const sessionName = interaction.fields.getTextInputValue('ten').trim();
    const gio = parseGio(interaction.fields.getTextInputValue('gio'));
    if (!gio) {
      return interaction.editReply({ content: '❌ Giờ mở không hợp lệ. Dùng định dạng HH:MM (vd: 20:00).' });
    }
    const preClose = parsePreClose(interaction.fields.getStringSelectValues('pre_close')?.[0]);
    const phutBu   = interaction.fields.getStringSelectValues('phut_bu')?.[0];
    const date = new Date(nam, thang - 1, ngay);
    if (Number.isNaN(date.getTime()) || date.getDate() !== ngay) {
      return interaction.editReply({ content: `❌ Ngày ${ngay}/${thang}/${nam} không hợp lệ.` });
    }
    if (date.getTime() <= Date.now()) {
      return interaction.editReply({ content: `❌ Ngày ${ngay}/${thang}/${nam} đã qua. Vui lòng chọn ngày trong tương lai.` });
    }
    const dayOfWeek = date.getDay();
    const cfg = await db.getGuildConfig(guildId);
    const channelId = cfg?.log_channel_id ?? cfg?.channel_id;
    if (!channelId) {
      return interaction.editReply({ content: '❌ Chưa cấu hình **Kênh log**. Vào `/setup` → Cài đặt chung → Kênh log.' });
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
      return interaction.editReply({ content: '❌ Không thể lưu lịch, thử lại sau.' });
    }
    return interaction.editReply({
      content: `✅ Đã thêm lịch **${sessionName}** — ${ngay}/${thang}/${nam} lúc **${String(gio.hour).padStart(2,'0')}:${String(gio.minute).padStart(2,'0')}** (đóng DD trước ${preClose}p).`,
    });
  }
}

module.exports = {
  SetupScheduleAddDetailModal,
  parseGio,
  parsePreClose,
  parsePhutBu,
};
