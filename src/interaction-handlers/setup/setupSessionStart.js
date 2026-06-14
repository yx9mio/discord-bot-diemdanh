// src/interaction-handlers/setup/setupSessionStart.js
// Handles: setup:session:start (Button) — mở modal nhập thông tin phiên
'use strict';
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { wrapHandler } = require('../../../utils/error-boundary.js');
const { checkCooldown } = require('../../../utils/cooldown.js');

const MODAL_ID = 'setup:session:start:modal';

class SetupSessionStartHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (interaction.customId === 'setup:session:start') return this.some();
    return this.none();
  }

  run(interaction) {
    return wrapHandler(async (interaction) => {
    if (!checkCooldown(interaction.user.id, 'setup_session_start', 5000)) {
      return interaction.reply({ content: '⏳ Vui lòng đợi một chút trước khi thực hiện hành động này.', flags: require('discord.js').MessageFlags.Ephemeral });
    }
    const modal = new ModalBuilder()
      .setCustomId(MODAL_ID)
      .setTitle('Mở phiên điểm danh mới');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ten_phien').setLabel('Tên phiên').setStyle(TextInputStyle.Short)
          .setMaxLength(100).setRequired(false).setPlaceholder('Để trống để đặt tên tự động'),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('mo_ta').setLabel('Mô tả (tuỳ chọn)').setStyle(TextInputStyle.Paragraph)
          .setMaxLength(500).setRequired(false),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('phut_dong').setLabel('Tự động đóng sau (phút) — 0 = không tự đóng')
          .setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('15 / 30 / 60 / 90 / 120 (mặc định 0)'),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('phai_role').setLabel('Role ID giới hạn (tuỳ chọn)')
          .setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('VD: 123456789012345678'),
      ),
    );
    return interaction.showModal(modal);
  }, 'SetupSessionStartHandler')(interaction); }
}

module.exports = { SetupSessionStartHandler };
