// src/interaction-handlers/setup/setupMemberAdd.js
// Handles: setup:mem:add (Button) — mở modal thêm thành viên
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { MemberView } = require('../../commands/setup/_views/_MemberView.js');

class SetupMemberAddHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }
  parse(interaction) {
    if (interaction.customId === 'setup:mem:add') return this.some();
    return this.none();
  }
  run(interaction) {
    return interaction.showModal(MemberView.buildAddModal());
  }
}

module.exports = { SetupMemberAddHandler };
