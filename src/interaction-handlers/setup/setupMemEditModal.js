'use strict';
// interaction-handlers/setup/setupMemEditModal.js
// [FIX-PATH] ../../../ → ../../../../
// [FIX-1] updateMember không tồn tại → dùng upsertMember
// [FIX-2] Field names: 'username' / 'phong_ban' / 'ghi_chu'
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const memberService = require('../../../services/memberService.js');
const { getGuildConfig } = require('../../../services/configService.js');
const log = require('../../../utils/logger.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { replyErrEdit } = require('../../../utils/embeds.js');
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
    const userId = interaction.customId.slice(MODAL_EDIT.length);
    if (!userId) return interaction.editReply(replyErrEdit('Không xác định được thành viên.'));

    const username     = interaction.fields.getTextInputValue('username')?.trim()     || null;
    const phongBan     = interaction.fields.getTextInputValue('phong_ban')?.trim()    || null;
    const ghiChu       = interaction.fields.getTextInputValue('ghi_chu')?.trim()      || null;
    const phaiRaw      = interaction.fields.getTextInputValue('phai_role_ids')?.trim() || null;
    const phaiRoleIds  = phaiRaw ? phaiRaw.split(',').map(s => s.trim()).filter(Boolean) : null;

    let currentUsername = username;
    if (!currentUsername) {
      const members = await memberService.getMembers(guild.id).catch(() => []);
      const m = members.find(x => x.user_id === userId);
      currentUsername = m?.username ?? userId;
    }

    try {
      await memberService.upsertMember({
        guildId:  guild.id,
        userId,
        username: currentUsername,
        phongBan,
        ghiChu,
        phaiRoleIds,
      });
      log.info('MEM_EDIT', guild.id, 'Sửa thành viên %s: username=%s phongBan=%s ghiChu=%s', userId, currentUsername, phongBan, ghiChu);
    } catch (e) {
      log.error('MEM_EDIT', guild.id, 'upsertMember thất bại: %s', e.message);
      return interaction.editReply(replyErrEdit('Không thể cập nhật, thử lại sau.'));
    }

    const [members, cfg] = await Promise.all([
      memberService.getMembers(guild.id).catch(() => []),
      getGuildConfig(guild.id).catch(() => null),
    ]);
    await interaction.editReply({ content: '✅ Đã cập nhật thành viên.' });
    await interaction.message?.edit(MemberView.render({ guild, members, cfg })).catch(() => null);
  }
}

module.exports = { SetupMemEditModalHandler };
