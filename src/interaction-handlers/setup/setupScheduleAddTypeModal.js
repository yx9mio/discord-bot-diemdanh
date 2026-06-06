// interaction-handlers/setup/setupScheduleAddTypeModal.js
// Modal 1 (Step 1): chọn LOẠI lịch (Recurring weekly / One-time).
// Sau khi submit → show Modal 2 phù hợp.
//
// [BUG-2&3] ONE-TIME gộp date+time vào 1 modal (2 bước);
//           RECURRING giữ nguyên flow cũ.
'use strict';
const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const log = require('../../../utils/logger.js');

// ── Custom IDs tập trung tại đây để các handler khác import ──
const CUSTOM_ID = Object.freeze({
  ADD_BTN:        'setup:sch:add',
  EDIT_BTN_PREFIX:'setup:sch:edit:',
  TYPE_MODAL:     'setup:sch:add:type',
  RECURRING_MODAL:'setup:sch:add:recurring:detail',
  ONETIME_MODAL:  'setup:sch:add:onetime:detail',
  EDIT_ONETIME_PREFIX: 'setup:sch:edit:onetime:',
  PAGE_NEXT:  'setup:sch:next',
  PAGE_PREV:  'setup:sch:prev',
  REFRESH:    'setup:sch:refresh',
  DEL_PREFIX:  'setup:sch:del:',
  DEL_CONFIRM: 'setup:sch:del:confirm:',
  DEL_CANCEL:  'setup:sch:del:cancel:',
});

// ── Nút "+ Thêm lịch" → show Modal bước 1 ──
class SetupScheduleAddBtnHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }
  parse(interaction) {
    if (interaction.customId === CUSTOM_ID.ADD_BTN) return this.some();
    return this.none();
  }
  run(interaction) {
    const modal = new ModalBuilder()
      .setCustomId(CUSTOM_ID.TYPE_MODAL)
      .setTitle('Thêm lịch tự động — Bước 1/2')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('loai')
            .setLabel('Loại lịch: "week" (hàng tuần) hoặc "once" (1 lần)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('week / once')
            .setRequired(true),
        ),
      );
    return interaction.showModal(modal);
  }
}

// ── Modal bước 1 submit → show Modal bước 2 tương ứng ──
class SetupScheduleAddTypeModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }
  parse(interaction) {
    if (interaction.customId === CUSTOM_ID.TYPE_MODAL) return this.some();
    return this.none();
  }
  async run(interaction) {
    const loai = interaction.fields.getTextInputValue('loai').trim().toLowerCase();

    if (loai === 'week' || loai === 'weekly' || loai === 'recurring') {
      const modal = new ModalBuilder()
        .setCustomId(CUSTOM_ID.RECURRING_MODAL)
        .setTitle('Thêm lịch hàng tuần — Bước 2/2')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('day_of_week')
              .setLabel('Ngày trong tuần (t2/t3/.../t7/cn hoặc 0-6)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('t2 = Thứ 2, t7 = Thứ 7, cn = CN')
              .setRequired(true),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('gio_mo')
              .setLabel('Giờ mở (HH:MM)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('20:00')
              .setRequired(true),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('phut_bu')
              .setLabel('Phiên dài bao nhiêu phút? (0 = không tự đóng)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('0 / 30 / 60 / 90')
              .setRequired(false),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('pre_close')
              .setLabel('Nhắc nhở trước bao nhiêu phút? (0 = tắt)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('30')
              .setRequired(false),
          ),
        );
      return interaction.showModal(modal);
    }

    if (loai === 'once' || loai === 'one_time' || loai === 'onetime' || loai === '1') {
      const modal = new ModalBuilder()
        .setCustomId(CUSTOM_ID.ONETIME_MODAL)
        .setTitle('Thêm lịch một lần — Bước 2/2')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('ngay')
              .setLabel('Ngày (DD/MM/YYYY hoặc YYYY-MM-DD)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('25/12/2025 hoặc 2025-12-25')
              .setRequired(true),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('gio_mo')
              .setLabel('Giờ mở (HH:MM)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('20:00')
              .setRequired(true),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('phut_bu')
              .setLabel('Phiên dài bao nhiêu phút? (0 = không tự đóng)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('0 / 30 / 60 / 90')
              .setRequired(false),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('pre_close')
              .setLabel('Nhắc nhở trước bao nhiêu phút? (0 = tắt)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('30')
              .setRequired(false),
          ),
        );
      return interaction.showModal(modal);
    }

    log.warn('SETUP_SCH_ADD', interaction.guildId, 'Loại lịch không xác định: %s', loai);
    return interaction.reply({
      content: '❌ Loại lịch không hợp lệ. Nhập **week** (hàng tuần) hoặc **once** (một lần).',
      flags: MessageFlags.Ephemeral,
    });
  }
}

module.exports = { SetupScheduleAddBtnHandler, SetupScheduleAddTypeModalHandler, CUSTOM_ID };
