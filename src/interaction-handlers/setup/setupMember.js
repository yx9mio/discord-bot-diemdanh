'use strict';
// interaction-handlers/setup/setupMember.js
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const memberService = require('../../../services/memberService.js');
const log = require('../../../utils/logger.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { MemberView } = require('../../commands/setup/_views/_MemberView.js'); // [FIX-SETUP]

const MEMBER_NAV_IDS = new Set([
  'setup:member', 'setup:mem:prev', 'setup:mem:next',
  'setup:mem:delete', 'setup:mem:delete:confirm', 'setup:mem:delete:cancel',
  'setup:mem:edit',
]);

class SetupMemberHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === 'setup:member' || id.startsWith('setup:mem:')) return this.some();
    return this.none();
  }

  async run(interaction) {
    const { customId, guild } = interaction;

    if (customId === 'setup:member') {
      await interaction.deferUpdate();
      const members = await memberService.getMembers(guild.id);
      return interaction.editReply(MemberView.render({ guild, members }));
    }

    if (customId === 'setup:mem:prev' || customId === 'setup:mem:next') {
      await interaction.deferUpdate();
      const members = await memberService.getMembers(guild.id);
      const currentPage = MemberView.getPageFromMessage(interaction.message);
      const newPage = customId === 'setup:mem:prev' ? currentPage - 1 : currentPage + 1;
      return interaction.editReply(MemberView.render({ guild, members, page: newPage }));
    }

    if (customId === 'setup:mem:delete') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { ok } = await requireAdmin(interaction, { context: 'xóa thành viên', deferred: true });
      if (!ok) return;
      const userId = MemberView.getSelectedUserId(interaction.message);
      if (!userId) return interaction.editReply({ content: '❌ Không tìm thấy thành viên được chọn.' });
      return interaction.editReply(MemberView.renderDeleteConfirm(userId));
    }

    if (customId === 'setup:mem:delete:confirm') {
      await interaction.deferUpdate();
      const userId = MemberView.getSelectedUserIdFromConfirm(interaction.message);
      if (!userId) return interaction.editReply({ content: '❌ Không tìm thấy thành viên.' });
      try {
        await memberService.deleteMember(guild.id, userId);
        log.info('MEM_DEL', guild.id, 'Xóa thành viên %s', userId);
      } catch (e) {
        log.error('MEM_DEL', guild.id, 'deleteMember thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể xóa, thử lại sau.' });
      }
      const members = await memberService.getMembers(guild.id).catch(() => []);
      return interaction.editReply(MemberView.render({ guild, members }));
    }

    if (customId === 'setup:mem:delete:cancel') {
      await interaction.deferUpdate();
      const members = await memberService.getMembers(guild.id);
      return interaction.editReply(MemberView.render({ guild, members }));
    }

    if (customId === 'setup:mem:edit') {
      const userId = MemberView.getSelectedUserId(interaction.message);
      if (!userId) return interaction.reply({ content: '❌ Không tìm thấy thành viên được chọn.', flags: MessageFlags.Ephemeral });
      const members = await memberService.getMembers(guild.id);
      const member = members.find(m => m.user_id === userId);
      return interaction.showModal(MemberView.buildEditModal(userId, member));
    }
  }
}

module.exports = { SetupMemberHandler };
