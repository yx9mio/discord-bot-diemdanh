// src/interaction-handlers/setup/setupMemberAddModal.js
// Handles: setup:mem:add:modal (ModalSubmit) — lưu thành viên mới
'use strict';
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const memberService = require('../../../services/memberService.js');
const log = require('../../../utils/logger.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { MemberView } = require('../../commands/setup/_views/_MemberView.js');

class SetupMemberAddModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }
  parse(interaction) {
    if (interaction.customId === 'setup:mem:add:modal') return this.some();
    return this.none();
  }
  async run(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { ok } = await requireAdmin(interaction, { context: 'thêm thành viên', deferred: true });
    if (!ok) return;

    const { guild } = interaction;
    const userId = interaction.fields.getTextInputValue('user_id').trim().replace(/[<@!>]/g, '');
    // [FIX] Modal dùng field 'display_name' và 'note' → map sang key đúng của upsertMember
    const displayName = interaction.fields.getTextInputValue('display_name')?.trim() || null;
    const note = interaction.fields.getTextInputValue('note')?.trim() || null;

    if (!userId) return interaction.editReply({ content: '❌ User ID không hợp lệ.' });

    let member;
    try {
      member = await guild.members.fetch(userId);
    } catch {
      return interaction.editReply({ content: `❌ Không tìm thấy user với ID: \`${userId}\`` });
    }
    if (member.user.bot) return interaction.editReply({ content: '❌ Không thể thêm bot vào danh sách.' });

    const username = displayName ?? member.nickname ?? member.user.displayName ?? member.user.username;
    try {
      // [FIX] Trước: upsertMember(guild.id, { user_id, username, display_name, note }) — sai signature (2 args + key sai)
      // Sau:  upsertMember({ guildId, userId, username, phongBan, ghiChu })         — đúng 1 arg object
      await memberService.upsertMember({
        guildId:  guild.id,
        userId,
        username,
        phongBan: null,
        ghiChu:   note,
      });
      log.info('MEM_ADD', guild.id, 'Thêm thành viên %s (%s)', userId, username);
    } catch (e) {
      log.error('MEM_ADD', guild.id, 'upsertMember thất bại: %s', e.message);
      return interaction.editReply({ content: '❌ Không thể thêm thành viên, thử lại sau.' });
    }

    const members = await memberService.getMembers(guild.id).catch(() => []);
    await interaction.editReply({ content: `✅ Đã thêm **${username}** vào danh sách.` });
    await interaction.message?.edit(MemberView.render({ guild, members })).catch(() => null);
  }
}

module.exports = { SetupMemberAddModalHandler };
