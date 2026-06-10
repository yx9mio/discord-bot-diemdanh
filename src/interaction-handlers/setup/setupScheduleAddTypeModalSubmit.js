// src/interaction-handlers/setup/setupScheduleAddTypeModalSubmit.js
// Handles: setup:sch:add:type (ModalSubmit) — xử lý bước 1, hiển thị Modal bước 2
'use strict';
const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const log = require('../../../utils/logger.js');

const TYPE_MODAL_ID = 'setup:sch:add:type';

class SetupScheduleAddTypeModalSubmitHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId === TYPE_MODAL_ID) return this.some();
    return this.none();
  }

  async run(interaction) {
    const loai = interaction.fields.getTextInputValue('loai').trim().toLowerCase();

    if (loai !== 'recurring' && loai !== 'onetime') {
      return interaction.reply({
        content: '❌ Loại lịch không hợp lệ. Nhập `recurring` hoặc `onetime`.',
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      let modal;
      if (loai === 'recurring') {
        modal = new ModalBuilder()
          .setCustomId('setup:sch:add:recurring:detail')
          .setTitle('Thêm lịch định kỳ — Chi tiết')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('thu').setLabel('Thứ (2-8 hoặc mon,tue,...)').setStyle(TextInputStyle.Short).setRequired(true),
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('gio_bat_dau').setLabel('Giờ bắt đầu (HH:mm)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('08:00'),
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('gio_ket_thuc').setLabel('Giờ kết thúc (HH:mm)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('09:00'),
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('ten').setLabel('Tên phiên (tuỳ chọn)').setStyle(TextInputStyle.Short).setRequired(false),
            ),
          );
      } else {
        modal = new ModalBuilder()
          .setCustomId('setup:sch:add:onetime:detail')
          .setTitle('Thêm lịch một lần — Chi tiết')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('ngay').setLabel('Ngày (YYYY-MM-DD)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('2025-06-15'),
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('gio_bat_dau').setLabel('Giờ bắt đầu (HH:mm)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('08:00'),
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('gio_ket_thuc').setLabel('Giờ kết thúc (HH:mm)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('09:00'),
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('ten').setLabel('Tên phiên (tuỳ chọn)').setStyle(TextInputStyle.Short).setRequired(false),
            ),
          );
      }

      return interaction.showModal(modal);
    } catch (e) {
      log.error('SCH_ADD_TYPE', interaction.guild?.id, 'Lỗi tạo modal bước 2: %s', e.message);
      return interaction.reply({ content: '❌ Lỗi nội bộ, thử lại sau.', flags: MessageFlags.Ephemeral });
    }
  }
}

module.exports = { SetupScheduleAddTypeModalSubmitHandler };
