// interaction-handlers/setup/setupScheduleEditOneTimeModal.js
// Button handler: setup:sch:edit:ot:<scheduleId>
//   Mở Combined Modal (DD/MM/YYYY + Giờ + Tên) để sửa lịch one-time.
//
// Modal submit handler: setup:sch:edit:ot:submit:<scheduleId>
//   Nhận dữ liệu từ combined modal, cập nhật DB.
//
// [FIX] Thay openOneTimeDateModal (removed) bằng openOneTimeCombinedModal.
'use strict';
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const db = require('../../db.js');
const log = require('../../utils/logger.js');
const { openOneTimeCombinedModal } = require('./setupScheduleAddTypeModal.js');
const { parseGio, parsePreClose, parsePhutBu } = require('./setupScheduleAddDetailModal.js');

const EDIT_OT_PREFIX        = 'setup:sch:edit:ot:';
const EDIT_OT_SUBMIT_PREFIX = 'setup:sch:edit:ot:submit:';

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

// ── Button handler: mở combined modal ─────────────────────────────────────
class SetupScheduleEditOneTimeHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    // chỉ match button (không match submit prefix)
    if (id?.startsWith(EDIT_OT_PREFIX) && !id.startsWith(EDIT_OT_SUBMIT_PREFIX)) return this.some();
    return this.none();
  }

  async run(interaction) {
    const scheduleId = interaction.customId.slice(EDIT_OT_PREFIX.length);
    const schedule = await db.getScheduledSessionById(scheduleId);

    // prefill nếu có data, không block nếu không tìm thấy
    const prefill = {};
    if (schedule) {
      const date = schedule.date ? new Date(schedule.date) : null;
      prefill.dayOfMonth  = date ? date.getDate()     : undefined;
      prefill.month       = date ? date.getMonth() + 1 : undefined;
      prefill.year        = date ? date.getFullYear()  : undefined;
      prefill.hour        = schedule.hour;
      prefill.minute      = schedule.minute;
      prefill.sessionName = schedule.session_name;
      prefill.preCloseMinutes = schedule.pre_close_minutes;
    }

    // Encode scheduleId vào customId của modal để submit handler biết cần sửa record nào
    // Đổi customId modal thành EDIT_OT_SUBMIT_PREFIX + scheduleId
    const modal = _buildCombinedModal(scheduleId, prefill);
    return interaction.showModal(modal);
  }
}

// ── Modal submit handler: lưu DB ───────────────────────────────────────────────
class SetupScheduleEditOneTimeModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId?.startsWith(EDIT_OT_SUBMIT_PREFIX)) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const scheduleId = interaction.customId.slice(EDIT_OT_SUBMIT_PREFIX.length);
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

    const dayOfWeek = date.getDay();
    const cfg = await db.getGuildConfig(guildId);
    const channelId = cfg?.log_channel_id ?? cfg?.channel_id;
    if (!channelId) {
      return interaction.editReply({ content: '❌ Chưa cấu hình Kênh log.' });
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
        closeHour: close.closeHour,
        closeMinute: close.closeMinute,
        channelId,
      });
    } catch (e) {
      log.error('SETUP_SCH_EDIT_OT', guildId, 'suaLichCoDinh thất bại: %s', e.message);
      return interaction.editReply({ content: '❌ Không thể sửa lịch, thử lại sau.' });
    }

    return interaction.editReply({
      content: `✅ Đã sửa lịch **${sessionName}** — ${ngay}/${thang}/${nam} lúc **${String(gio.hour).padStart(2,'0')}:${String(gio.minute).padStart(2,'0')}**.`,
    });
  }
}

// ── Internal: build combined modal với customId chứa scheduleId ───────────────
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

function _buildCombinedModal(scheduleId, prefill = {}) {
  const currentYear = new Date().getFullYear();
  const modal = new ModalBuilder()
    .setCustomId(`${EDIT_OT_SUBMIT_PREFIX}${scheduleId}`)
    .setTitle('✏️ Sửa lịch một lần');

  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('ngay_thang_nam')
      .setLabel('Ngày tháng năm (DD/MM/YYYY)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(10)
      .setPlaceholder('VD: 15/06/2026')
      .setValue(
        prefill.dayOfMonth
          ? `${String(prefill.dayOfMonth).padStart(2,'0')}/${String(prefill.month).padStart(2,'0')}/${prefill.year ?? currentYear}`
          : '',
      ),
  ));

  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('gio')
      .setLabel('Giờ mở (HH:MM)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('20:00')
      .setMaxLength(5)
      .setRequired(true)
      .setValue(prefill.hour != null ? `${String(prefill.hour).padStart(2,'0')}:${String(prefill.minute ?? 0).padStart(2,'0')}` : '20:00'),
  ));

  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('ten')
      .setLabel('Tên phiên')
      .setStyle(TextInputStyle.Short)
      .setMaxLength(100)
      .setRequired(true)
      .setValue(prefill.sessionName ?? 'Điểm danh'),
  ));

  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('pre_close')
      .setLabel('Đóng DD trước X phút (mặc định 30)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('0 = không tự đóng')
      .setValue(String(prefill.preCloseMinutes ?? 30)),
  ));

  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('phut_bu')
      .setLabel('Phút đóng sau giờ mở (VD: 60 / none)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setPlaceholder('Để trống = đóng thủ công')
      .setValue(prefill.closeHour ? '60' : ''),
  ));

  return modal;
}

module.exports = { SetupScheduleEditOneTimeHandler, SetupScheduleEditOneTimeModalHandler };
