'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { MessageFlags } = require('discord.js');
const { wrapHandler } = require('../../../utils/error-boundary.js');
const { checkCooldown } = require('../../../utils/cooldown.js');
const wizardDraft = require('../../../utils/wizardDraft.js');
const { renderStep2, SELECT_CH, SELECT_ROLE } = require('../../../utils/_views/wizardView.js');

class SetupSessionWizardSelectHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.SelectMenu });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === SELECT_CH || id === SELECT_ROLE) return this.some();
    return this.none();
  }

  async run(interaction) {
    return wrapHandler(async (interaction) => {
    if (!checkCooldown(interaction.user.id, 'setup_wizard_select', 1000)) {
      return interaction.reply({ content: '⏳ Vui lòng đợi một chút...', flags: MessageFlags.Ephemeral });
    }
    await interaction.deferUpdate();
    const { guild } = interaction;
    const draft = wizardDraft.get(interaction.user.id);
    if (!draft) {
      return interaction.editReply({ content: '⏳ Phiên tạo đã hết hạn, bấm **➕ Mở Kỳ mới** để bắt đầu lại.', embeds: [], components: [] });
    }

    const value = interaction.values?.[0] ?? 'none';
    if (interaction.customId === SELECT_CH) {
      draft.channelId = value === 'none' ? null : value;
    } else {
      draft.roleId = value === 'none' ? null : value;
    }
    wizardDraft.put(interaction.user.id, draft);

    return interaction.editReply(renderStep2({ guild, draft }));
  }, 'SetupSessionWizardSelect')(interaction); }
}

module.exports = { SetupSessionWizardSelectHandler };