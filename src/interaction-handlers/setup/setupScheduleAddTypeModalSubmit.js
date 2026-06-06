// src/interaction-handlers/setup/setupScheduleAddTypeModalSubmit.js
// Handles: setup:sch:add:type (ModalSubmit) — xử lý bước 1, hiển thị Modal bước 2
'use strict';
const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const log = require('../../../utils/logger.js');
const { CUSTOM_ID } = require('./setupScheduleAddTypeModal.js');

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
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('day_of_week').setLabel('Ngày trong tuần (t2/t3/.../t7/cn hoặc 0-6)').setStyle(TextInputStyle.Short).setPlaceholder('t2 = Thứ 2, t7 = Thứ 7, cn = CN').setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('gio_mo').setLabel('Giờ mở (HH:MM)').setStyle(TextInputStyle.Short).setPlaceholder('20:00').setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('phut_bu').setLabel('Phiên dài bao nhiêu phút? (0 = không tự đóng)').setStyle(TextInputStyle.Short).setPlaceholder('0 / 30 / 60 / 90').setRequired(false)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pre_close').setLabel('Nhắc nhở trước bao nhiêu phút? (0 = tắt)').setStyle(TextInputStyle.Short).setPlaceholder('30').setRequired(false)),
        );
      return interaction.showModal(modal);
    }
    if (loai === 'once' || loai === 'one_time' || loai === 'onetime' || loai === '1') {
      const modal = new ModalBuilder()
        .setCustomId(CUSTOM_ID.ONETIME_MODAL)
        .setTitle('Thêm lịch một lần — Bước 2/2')
        .addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ngay').setLabel('Ngày (DD/MM/YYYY hoặc YYYY-MM-DD)').setStyle(TextInputStyle.Short).setPlaceholder('25/12/2025 hoặc 2025-12-25').setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('gio_mo').setLabel('Giờ mở (HH:MM)').setStyle(TextInputStyle.Short).setPlaceholder('20:00').setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('phut_bu').setLabel('Phiên dài bao nhiêu phút? (0 = không tự đóng)').setStyle(TextInputStyle.Short).setPlaceholder('0 / 30 / 60 / 90').setRequired(false)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pre_close').setLabel('Nhắc nhở trước bao nhiêu phút? (0 = tắt)').setStyle(TextInputStyle.Short).setPlaceholder('30').setRequired(false)),
        );
      return interaction.showModal(modal);
    }
    log.warn('SETUP_SCH_ADD', interaction.guildId, 'Loại lịch không xác định: %s', loai);
    return interaction.reply({ content: '❌ Loại lịch không hợp lệ. Nhập **week** (hàng tuần) hoặc **once** (một lần).', flags: MessageFlags.Ephemeral });
  }
}

module.exports = { SetupScheduleAddTypeModalHandler };
