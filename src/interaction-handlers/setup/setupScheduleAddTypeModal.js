'use strict';
// Handles: setup:sch:add:r / setup:sch:add:o (Button)
// Recurring → render select menus in message; One-time → modal (text inputs for date)
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { requireAdmin } = require('../../../utils/permissions.js');
const { clearState } = require('../../../utils/scheduleAddState.js');
const { renderAddViewStep1 } = require('../../../utils/scheduleAddViews.js');

const ADD_R = 'setup:sch:add:r';
const ADD_O = 'setup:sch:add:o';

function _buildOnetimeModal() {
  return new ModalBuilder()
    .setCustomId('setup:sch:add:onetime:detail')
    .setTitle('Thêm lịch một lần')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ngay').setLabel('Ngày (YYYY-MM-DD)')
          .setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('2026-06-15'),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('gio_mo').setLabel('Giờ mở (HH:mm)')
          .setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('08:00'),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('phut_bu').setLabel('Thời lượng (phút)')
          .setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('45'),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('pre_close').setLabel('Nhắc trước (phút, mặc định 30)')
          .setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('30'),
      ),
    );
}

class SetupScheduleAddTypeModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (interaction.customId === ADD_R || interaction.customId === ADD_O) return this.some();
    return this.none();
  }

  async run(interaction) {
    const { ok } = await requireAdmin(interaction, { context: 'thêm lịch', deferred: false });
    if (!ok) return;

    if (interaction.customId === ADD_O) {
      return interaction.showModal(_buildOnetimeModal());
    }

    // Recurring: show select menus
    await interaction.deferUpdate();
    clearState(interaction.guild.id);
    return interaction.editReply(renderAddViewStep1(interaction.guild, {}));
  }
}

module.exports = { SetupScheduleAddTypeModalHandler };
