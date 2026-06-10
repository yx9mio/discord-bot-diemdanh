// src/interaction-handlers/setup/setupMemberAddModal.js
// Handles: setup:mem:add:modal (ModalSubmit)
// [FIX-PATH] ../../../services/ (3 cấp từ src/interaction-handlers/setup/)
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const memberService = require('../../../services/memberService.js');
const log = require('../../../utils/logger.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { MemberView } = require('../../commands/setup/_views/_MemberView.js');

const MODAL_ADD = 'setup:mem:add:modal';

class SetupMemberAddModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId === MODAL_ADD) return this.some();
    return this.none();
  }

  async run(interaction) {
    const { ok } = await requireAdmin(interaction, { context: 'thêm thành viên', deferred: false });
    if (!ok) return;
    await interaction.deferUpdate();
    const { guild } = interaction;

    const userId = interaction.fields.getTextInputValue('user_id').trim().replace(/[<@>]/g, '');
    const username = interaction.fields.getTextInputValue('username').trim();
    const phongBan = interaction.fields.getTextInputValue('phong_ban')?.trim() ?? '';
    const ghiChu = interaction.fields.getTextInputValue('ghi_chu')?.trim() ?? '';

    try {
      await memberService.upsertMember({ guildId: guild.id, userId, username, phongBan, ghiChu });
      const members = await memberService.getMembers(guild.id);
      return interaction.editReply(MemberView.render({ members, guild, page: 0 }));
    } catch (e) {
      log.error('MEMBER_ADD', guild.id, 'Lỗi thêm %s: %s', userId, e.message);
      return interaction.editReply({ content: `❌ Không thể thêm thành viên: ${e.message}` });
    }
  }
}

module.exports = { SetupMemberAddModalHandler };
