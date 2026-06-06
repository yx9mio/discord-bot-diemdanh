'use strict';
// interaction-handlers/setup/setupMemEditModal.js
// [FIX-1] updateMember không tồn tại → dùng upsertMember
// [FIX-2] Field names sai (display_name/note) → đúng (username/phong_ban/ghi_chu) theo _MemberView modal
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const memberService = require('../../../services/memberService.js');
const log = require('../../../utils/logger.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { MemberView } = require('../../commands/setup/_views/_MemberView.js');

const MODAL_EDIT = 'setup:mem:edit:modal:';

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
    // customId = 'setup:mem:edit:modal:<userId>'
    const userId = interaction.customId.slice(MODAL_EDIT.length);
    if (!userId) return interaction.editReply({ content: '❌ Không xác định được thành viên.' });

    // [FIX-2] Đọc đúng field theo _MemberView.buildEditModal: 'username' / 'phong_ban' / 'ghi_chu'
    const username  = interaction.fields.getTextInputValue('username')?.trim()   || null;
    const phongBan  = interaction.fields.getTextInputValue('phong_ban')?.trim()  || null;
    const ghiChu    = interaction.fields.getTextInputValue('ghi_chu')?.trim()    || null;

    // Lấy member hiện tại để giữ username cũ nếu không nhập mới
    let currentUsername = username;
    if (!currentUsername) {
      const members = await memberService.getMembers(guild.id).catch(() => []);
      const m = members.find(x => x.user_id === userId);
      currentUsername = m?.username ?? userId;
    }

    try {
      // [FIX-1] updateMember không tồn tại — dùng upsertMember với đúng key camelCase
      await memberService.upsertMember({
        guildId:  guild.id,
        userId,
        username: currentUsername,
        phongBan,
        ghiChu,
      });
      log.info('MEM_EDIT', guild.id, 'Sửa thành viên %s: username=%s phongBan=%s ghiChu=%s', userId, currentUsername, phongBan, ghiChu);
    } catch (e) {
      log.error('MEM_EDIT', guild.id, 'upsertMember thất bại: %s', e.message);
      return interaction.editReply({ content: '❌ Không thể cập nhật, thử lại sau.' });
    }

    const members = await memberService.getMembers(guild.id).catch(() => []);
    await interaction.editReply({ content: '✅ Đã cập nhật thành viên.' });
    await interaction.message?.edit(MemberView.render({ guild, members })).catch(() => null);
  }
}

module.exports = { SetupMemEditModalHandler };
