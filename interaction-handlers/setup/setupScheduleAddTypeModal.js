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
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
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

  // StringSelect "Loại"
  const typeSelect = new StringSelectMenuBuilder()
    .setCustomId('loai')
    .setPlaceholder('Chọn loại lịch...')
    .addOptions([
      { label: '🔁 Hằng tuần',  value: 'recurring', description: 'Lặp lại mỗi tuần theo thứ' },
      { label: '📅 Một lần',     value: 'one_time',  description: 'Chạy đúng 1 lần vào ngày cụ thể' },
    ]);
  const row = new ActionRowBuilder().addComponents(typeSelect);
  modal.addComponents(row);
  return interaction.showModal(modal);
}

// Mở Modal 2 cho Recurring: Thứ + Tên + Giờ + Phút + pre_close = 5 rows
function openRecurringDetailModal(interaction, prefill = {}) {
  const modal = new ModalBuilder()
    .setCustomId(CUSTOM_ID.DETAIL_R)
    .setTitle('➕ Lịch hằng tuần — Bước 2/2');

  // Row 1: Thứ (Select)
  const thuSelect = new StringSelectMenuBuilder()
    .setCustomId('thu')
    .setPlaceholder('Thứ trong tuần...')
    .addOptions(DAY_LABELS.slice(1).map((lbl, i) => ({
      label: lbl,
      value: String(i + 1),
      default: prefill.dayOfWeek === i + 1,
    })));
  modal.addComponents(new ActionRowBuilder().addComponents(thuSelect));

  // Row 2: Tên phiên (TextInput)
  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('ten')
      .setLabel('Tên phiên')
      .setStyle(TextInputStyle.Short)
      .setMaxLength(100)
      .setRequired(true)
      .setValue(prefill.sessionName ?? 'Diểm danh'),
  ));

  // Row 3: Giờ mở (TextInput HH:MM)
  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('gio')
      .setLabel('Giờ mở (HH:MM, 0-23:0-59)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('20:00')
      .setMaxLength(5)
      .setRequired(true)
      .setValue(prefill.hour != null ? `${String(prefill.hour).padStart(2,'0')}:${String(prefill.minute ?? 0).padStart(2,'0')}` : '20:00'),
  ));

  // Row 4: pre_close (Select)
  const preCloseSelect = new StringSelectMenuBuilder()
    .setCustomId('pre_close')
    .setPlaceholder('Đóng điểm danh trước giờ mở...')
    .addOptions(PRE_CLOSE_OPTIONS.map(p => ({
      label: p === 0 ? '⏹️ Không tự đóng' : `⏱️ Trước ${p} phút`,
      value: String(p),
      description: p === 0
        ? 'Phiên chỉ đóng khi admin dùng /ketthuc'
        : p === 30
          ? 'Mặc định — phù hợp giải đấu/sự kiện'
          : `Đóng DD trước ${p} phút để chuẩn bị`,
      default: (prefill.preCloseMinutes ?? 30) === p,
    })));
  modal.addComponents(new ActionRowBuilder().addComponents(preCloseSelect));

  // Row 5: Phút đóng (Select 0/15/30/45) — tuỳ chọn
  const phutSelect = new StringSelectMenuBuilder()
    .setCustomId('phut_bu')
    .setPlaceholder('Phút đóng phiên (tuỳ chọn, mặc định = giờ mở + 60\')')
    .addOptions([
      { label: 'Không đặt (đóng thủ công)', value: 'none', default: !prefill.closeHour },
      { label: '+30 phút sau giờ mở', value: '30' },
      { label: '+60 phút (1 giờ)',       value: '60', default: !prefill.closeHour },
      { label: '+90 phút (1.5 giờ)',     value: '90' },
      { label: '+120 phút (2 giờ)',      value: '120' },
    ]);
  modal.addComponents(new ActionRowBuilder().addComponents(phutSelect));

  return interaction.showModal(modal);
}

// Mở Modal 2a cho One-time: Ngày + Tháng + Năm
function openOneTimeDateModal(interaction, prefill = {}) {
  const modal = new ModalBuilder()
    .setCustomId(CUSTOM_ID.DETAIL_O_A)
    .setTitle('➕ Lịch một lần — Bước 2/3: Ngày');

  // Row 1: Ngày (1-31)
  const ngaySelect = new StringSelectMenuBuilder()
    .setCustomId('ngay')
    .setPlaceholder('Ngày (1-31)...')
    .addOptions(Array.from({ length: 31 }, (_, i) => i + 1).map(d => ({
      label: `Ngày ${d}`, value: String(d),
      default: prefill.dayOfMonth === d,
    })));
  modal.addComponents(new ActionRowBuilder().addComponents(ngaySelect));

  // Row 2: Tháng (1-12)
  const thangSelect = new StringSelectMenuBuilder()
    .setCustomId('thang')
    .setPlaceholder('Tháng (1-12)...')
    .addOptions(Array.from({ length: 12 }, (_, i) => i + 1).map(t => ({
      label: `Tháng ${t}`, value: String(t),
      default: prefill.month === t,
    })));
  modal.addComponents(new ActionRowBuilder().addComponents(thangSelect));

  // Row 3: Năm
  const currentYear = new Date().getFullYear();
  const namSelect = new StringSelectMenuBuilder()
    .setCustomId('nam')
    .setPlaceholder('Năm...')
    .addOptions([currentYear, currentYear + 1].map(y => ({
      label: `Năm ${y}`, value: String(y),
      default: prefill.year === y || (!prefill.year && y === currentYear),
    })));
  modal.addComponents(new ActionRowBuilder().addComponents(namSelect));

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
      .setValue(prefill.sessionName ?? 'Diểm danh'),
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

  const preCloseSelect = new StringSelectMenuBuilder()
    .setCustomId('pre_close')
    .setPlaceholder('Đóng điểm danh trước giờ mở...')
    .addOptions(PRE_CLOSE_OPTIONS.map(p => ({
      label: p === 0 ? '⏹️ Không tự đóng' : `⏱️ Trước ${p} phút`,
      value: String(p),
      default: (prefill.preCloseMinutes ?? 30) === p,
    })));
  modal.addComponents(new ActionRowBuilder().addComponents(preCloseSelect));

  const phutSelect = new StringSelectMenuBuilder()
    .setCustomId('phut_bu')
    .setPlaceholder('Phút đóng phiên (tuỳ chọn)...')
    .addOptions([
      { label: 'Không đặt (đóng thủ công)', value: 'none', default: !prefill.closeHour },
      { label: '+30 phút sau giờ mở', value: '30' },
      { label: '+60 phút (1 giờ)',       value: '60', default: !prefill.closeHour },
      { label: '+90 phút (1.5 giờ)',     value: '90' },
      { label: '+120 phút (2 giờ)',      value: '120' },
    ]);
  modal.addComponents(new ActionRowBuilder().addComponents(phutSelect));

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
    const loai = interaction.fields.getStringSelectValue?.('loai') ?? interaction.fields.getSelect?.('loai');
    log.info('SETUP_SCH_TYPE', interaction.guildId, 'User chọn loại: %s', loai);
    if (loai === 'recurring') {
      return openRecurringDetailModal(interaction);
    }
    if (loai === 'one_time') {
      return openOneTimeDateModal(interaction);
    }
    return interaction.reply({ content: '❌ Loại lịch không hợp lệ.', ephemeral: true });
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
