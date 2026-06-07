// src/interaction-handlers/setup/setupMemberAddModal.js
// Handles: setup:mem:add:modal (ModalSubmit)
// [FIX-PATH] ../../../services/ (3 cấp từ src/interaction-handlers/setup/)
'use strict';
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const memberService = require('../../../services/memberService.js');
const log = require('../../../utils/logger.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { MemberView } = require('../../commands/setup/_views/_MemberView.js');

const MODAL_ID = 'setup:mem:add:modal';

class SetupMemberAddModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId === MODAL_ID) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { ok } = await requireAdmin(interaction, { context: 'thêm thành viên', deferred: true });
    if (!ok) return;

    const { guild } = interaction;
    const rawId = interaction.fields.getTextInputValue('user_id').trim().replace(/[<@!>]/g, '');
    const nick  = interaction.fields.getTextInputValue('nickname')?.trim() || null;
    const phong = interaction.fields.getTextInputValue('phong_ban')?.trim() || null;

    if (!/^\d{10,20}$/.test(rawId)) {
      return interaction.editReply({ content: '❌ User ID không hợp lệ. Vui lòng nhập chuỗi số ID của Discord.' });
    }

    try {
      await memberService.addMember({ guild_id: guild.id, user_id: rawId, nickname: nick, phong_ban: phong });
      log.info('MEM_ADD', guild.id, 'Thêm thành viên %s', rawId);
      const members = await memberService.getMembers(guild.id).catch(() => []);
      await interaction.editReply({ content: `✅ Đã thêm <@${rawId}> vào danh sách.` });
      await interaction.message?.edit(MemberView.render({ guild, members })).catch(() => null);
    } catch (e) {
      if (e.code === '23505') {
        return interaction.editReply({ content: `⚠️ <@${rawId}> đã có trong danh sách.` });
      }
      log.error('MEM_ADD', guild.id, 'addMember thất bại: %s', e.message);
      return interaction.editReply({ content: '❌ Không thể thêm thành viên, thử lại sau.' });
    }
  }
}

module.exports = { SetupMemberAddModalHandler };
