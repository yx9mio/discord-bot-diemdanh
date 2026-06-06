'use strict';
// interaction-handlers/setup/setupMemEditModal.js
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const memberService = require('../../../services/memberService.js');
const log = require('../../../utils/logger.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { MemberView } = require('../../commands/setup/_views/_MemberView.js');

const MODAL_EDIT = 'setup:mem:edit:modal';

class SetupMemEditModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId.startsWith(MODAL_EDIT)) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { ok } = await requireAdmin(interaction, { context: 'sửa thành viên', deferred: true });
    if (!ok) return;

    const { guild } = interaction;
    const userId = interaction.customId.split(':').pop();
    const displayName = interaction.fields.getTextInputValue('display_name')?.trim() || null;
    const note = interaction.fields.getTextInputValue('note')?.trim() || null;

    try {
      await memberService.updateMember(guild.id, userId, { display_name: displayName, note });
      log.info('MEM_EDIT', guild.id, 'Sửa thành viên %s: name=%s note=%s', userId, displayName, note);
    } catch (e) {
      log.error('MEM_EDIT', guild.id, 'updateMember thất bại: %s', e.message);
      return interaction.editReply({ content: '❌ Không thể cập nhật, thử lại sau.' });
    }

    const members = await memberService.getMembers(guild.id).catch(() => []);
    const view = MemberView.render({ guild, members });
    await interaction.editReply({ content: '✅ Đã cập nhật thành viên.' });
    await interaction.message?.edit(view).catch(() => null);
  }
}

module.exports = { SetupMemEditModalHandler };
