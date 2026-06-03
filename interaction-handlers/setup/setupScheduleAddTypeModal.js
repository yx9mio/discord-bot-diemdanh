// interaction-handlers/setup/setupScheduleAddTypeModal.js
// Modal 1 (Step 1): chọn LOẠI lịch (Recurring weekly / One-time).
// Sau khi submit → show Modal 2 phù hợp.
//
// (Commit 5: Q7=a 2-step modal. Recurring fits 2 modals; One-time fits 3 modals
//  vì Discord giới hạn 5 ActionRow / 1 component per row.)
'use strict';
const {
  InteractionHandler, InteractionHandlerTypes,
} = require('@sapphire/framework');
const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const log = require('../../utils/logger.js');

const CUSTOM_ID = {
  TYPE:  'setup:sch:add:type',           // Modal 1 submit
  DETAIL_R: 'setup:sch:add:detail:r',    // Modal 2 (Recurring)
  DETAIL_O_A: 'setup:sch:add:detail:o:a',// Modal 2a (One-time: Ngày/Tháng/Năm)
  TIME_O: 'setup:sch:add:time:o',        // Modal 2b (One-time: Tên + Giờ + Phút + pre_close)
};

const PRE_CLOSE_OPTIONS = [0, 15, 30, 45, 60, 90];

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

// Mở Modal 1 (Loại lịch) từ interaction
function openTypeModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId(CUSTOM_ID.TYPE)
    .setTitle('➕ Thêm lịch — Bước 1/2: Loại');

  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('loai')
      .setLabel('Loại lịch (recurring / one_time)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('Gõ "recurring" (hằng tuần) hoặc "one_time" (một lần)'),
  ));
  return interaction.showModal(modal);
}

// Mở Modal 2 cho Recurring: Thứ + Tên + Giờ + Phút + pre_close = 5 rows
function openRecurringDetailModal(interaction, prefill = {}, scheduleId = null) {
  const customId = scheduleId ? `setup:sch:edit:r:${scheduleId}` : CUSTOM_ID.DETAIL_R;
  const modal = new ModalBuilder()
    .setCustomId(customId)
    .setTitle(scheduleId ? '✏️ Sửa lịch hằng tuần' : '➕ Lịch hằng tuần — Bước 2/2');

  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('thu')
      .setLabel('Thứ (0=CN,1=T2..6=T7)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(1)
      .setPlaceholder('VD: 2 cho thứ Ba')
      .setValue(prefill.dayOfWeek != null ? String(prefill.dayOfWeek) : ''),
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

  return interaction.showModal(modal);
}

// Mở Modal 2a cho One-time: Ngày + Tháng + Năm
function openOneTimeDateModal(interaction, prefill = {}) {
  const modal = new ModalBuilder()
    .setCustomId(CUSTOM_ID.DETAIL_O_A)
    .setTitle('➕ Lịch một lần — Bước 2/3: Ngày');

  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('ngay')
      .setLabel('Ngày (1-31)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(2)
      .setPlaceholder('VD: 15')
      .setValue(prefill.dayOfMonth ? String(prefill.dayOfMonth) : ''),
  ));

  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('thang')
      .setLabel('Tháng (1-12)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(2)
      .setPlaceholder('VD: 6')
      .setValue(prefill.month ? String(prefill.month) : ''),
  ));

  const currentYear = new Date().getFullYear();
  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('nam')
      .setLabel('Năm')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(4)
      .setPlaceholder('VD: 2026')
      .setValue(prefill.year ? String(prefill.year) : String(currentYear)),
  ));

  return interaction.showModal(modal);
}

// Mở Modal 2b cho One-time: Tên + Giờ + Phút + pre_close
function openOneTimeTimeModal(interaction, prefill = {}) {
  const modal = new ModalBuilder()
    .setCustomId(CUSTOM_ID.TIME_O)
    .setTitle('➕ Lịch một lần — Bước 3/3: Giờ');

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

  return interaction.showModal(modal);
}

class SetupScheduleAddTypeModal extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId === CUSTOM_ID.TYPE) return this.some();
    return this.none();
  }

  run(interaction) {
    const loai = (interaction.fields.getTextInputValue('loai') || '').trim().toLowerCase();
    log.info('SETUP_SCH_TYPE', interaction.guildId, 'User chọn loại: %s', loai);
    if (loai === 'recurring') {
      return openRecurringDetailModal(interaction);
    }
    if (loai === 'one_time') {
      return openOneTimeDateModal(interaction);
    }
    return interaction.reply({ content: '❌ Loại lịch không hợp lệ. Gõ "recurring" hoặc "one_time".', flags: MessageFlags.Ephemeral });
  }
}

module.exports = {
  SetupScheduleAddTypeModal,
  CUSTOM_ID,
  PRE_CLOSE_OPTIONS,
  openTypeModal,
  openRecurringDetailModal,
  openOneTimeDateModal,
  openOneTimeTimeModal,
};
