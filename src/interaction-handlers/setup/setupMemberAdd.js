// src/interaction-handlers/setup/setupMemberAdd.js
// Handles: setup:mem:add (Button) — mở modal thêm thành viên
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { requireAdmin } = require('../../../utils/permissions.js');
const { MemberView } = require('../../commands/setup/_views/_MemberView.js');
const { wrapHandler } = require('../../../utils/error-boundary.js');
const { checkCooldown } = require('../../../utils/cooldown.js');

class SetupMemberAddHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }
  parse(interaction) {
    if (interaction.customId === 'setup:mem:add') return this.some();
    return this.none();
  }
  async run(interaction) {
    return wrapHandler(async (interaction) => {
    const { ok } = await requireAdmin(interaction, { context: 'thêm thành viên' });
    if (!ok) return;
    if (!checkCooldown(interaction.user.id, 'setup_mem_add', 1000)) {
      return interaction.reply({ content: '⏳ Vui lòng đợi một chút trước khi thực hiện hành động này.', flags: require('discord.js').MessageFlags.Ephemeral });
    }
    return interaction.showModal(MemberView.buildAddModal());
  }, 'SetupMemberAddHandler')(interaction); }
}

module.exports = { SetupMemberAddHandler };
