// src/interaction-handlers/setup/setupMemberAddModal.js
// Handles: setup:mem:add:modal (ModalSubmit)
// [FIX-PATH] ../../../services/ (3 cấp từ src/interaction-handlers/setup/)
'use strict';
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const memberService = require('../../../services/memberService.js');
const log = require('../../../utils/logger.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { replyErrEdit } = require('../../../utils/embeds.js');
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
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { ok } = await requireAdmin(interaction, { context: 'thêm thành viên', deferred: true });
    if (!ok) return;
    const { guild } = interaction;

    const userId = interaction.fields.getTextInputValue('user_id').trim().replace(/[<@>]/g, '');
    if (!userId) return interaction.editReply(replyErrEdit('Vui lòng nhập ID hoặc mention thành viên.'));
    const username = interaction.fields.getTextInputValue('username').trim();
    const phongBan = interaction.fields.getTextInputValue('phong_ban')?.trim() ?? '';
    const ghiChu = interaction.fields.getTextInputValue('ghi_chu')?.trim() ?? '';

    try {
      await memberService.upsertMember({ guildId: guild.id, userId, username, phongBan, ghiChu });
      const members = await memberService.getMembers(guild.id);
      await interaction.message?.edit(MemberView.render({ members, guild, page: 0 })).catch(() => null);
      return interaction.editReply({ content: '✅ Đã thêm thành viên.' });
    } catch (e) {
      log.error('MEMBER_ADD', guild.id, 'Lỗi thêm %s: %s', userId, e.message);
      return interaction.editReply(replyErrEdit(`Không thể thêm thành viên: ${e.message}`));
    }
  }
}

module.exports = { SetupMemberAddModalHandler };
