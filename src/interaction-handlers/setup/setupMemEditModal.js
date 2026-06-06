// interaction-handlers/setup/setupMemEditModal.js
// Handles: setup:mem:edit:modal:<userId>
'use strict';
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const memberService = require('../../../../services/memberService.js');
const log = require('../../../../utils/logger.js');
const { requireAdmin } = require('../../../../utils/permissions.js');
const { MemberView } = require('../../commands/setup/_views/_MemberView.js');

const MODAL_PREFIX = 'setup:mem:edit:modal:';

class SetupMemEditModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId?.startsWith(MODAL_PREFIX)) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { ok } = await requireAdmin(interaction, { context: 'chỉnh sửa thành viên', deferred: true });
    if (!ok) return;

    const { guild } = interaction;
    const userId = interaction.customId.slice(MODAL_PREFIX.length);
    if (!userId) return interaction.editReply({ content: '❌ Không tìm thấy User ID.' });

    const nickname = interaction.fields.getTextInputValue('nickname')?.trim() || null;
    const phongBan = interaction.fields.getTextInputValue('phong_ban')?.trim() || null;

    try {
      await memberService.upsertMember({ guild_id: guild.id, user_id: userId, nickname, phong_ban: phongBan });
      log.info('MEM_EDIT', guild.id, 'Cập nhật %s: nickname=%s phong_ban=%s', userId, nickname, phongBan);
      return interaction.editReply({ content: `✅ Đã cập nhật thông tin <@${userId}>.` });
    } catch (e) {
      log.error('MEM_EDIT', guild.id, 'upsertMember thất bại: %s', e.message);
      return interaction.editReply({ content: '❌ Không thể cập nhật, thử lại sau.' });
    }
  }
}

module.exports = { SetupMemEditModalHandler };
