// src/interaction-handlers/setup/setupMemberAddModal.js
// Handles: setup:mem:add:modal (ModalSubmit)
// [FIX-PATH] ../../../services/ (3 cấp từ src/interaction-handlers/setup/)
'use strict';
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const memberService = require('../../../services/memberService.js');
const { getGuildConfig } = require('../../../services/configService.js');
const log = require('../../../utils/logger.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { auditLog } = require('../../../utils/auditLog.js');
const { replyErrEdit } = require('../../../utils/embeds.js');
const { MemberView } = require('../../commands/setup/_views/_MemberView.js');
const { wrapHandler } = require('../../../utils/error-boundary.js');
const { checkCooldown } = require('../../../utils/cooldown.js');

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
    return wrapHandler(async (interaction) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { ok } = await requireAdmin(interaction, { context: 'thêm thành viên', deferred: true });
    if (!ok) return;
    if (!checkCooldown(interaction.user.id, 'setup_mem_add_modal', 5000)) {
      return interaction.editReply({ content: '⏳ Vui lòng đợi một chút trước khi thực hiện hành động này.' });
    }
    const { guild } = interaction;

    const rawId = interaction.fields.getTextInputValue('user_id').trim();
    if (!rawId) return interaction.editReply(replyErrEdit('Vui lòng nhập ID hoặc mention thành viên.'));
    if (rawId.startsWith('<@&')) return interaction.editReply(replyErrEdit('Vui lòng nhập ID người dùng, không phải role.'));
    const userId = rawId.replace(/[<@!>]/g, '');
    const username = interaction.fields.getTextInputValue('username').trim();
    const phongBan = interaction.fields.getTextInputValue('phong_ban')?.trim() ?? '';
    const ghiChu = interaction.fields.getTextInputValue('ghi_chu')?.trim() ?? '';

    try {
      await memberService.upsertMember({ guildId: guild.id, userId, username, phongBan, ghiChu });
      auditLog({ guildId: guild.id, actorId: interaction.user.id, action: 'MEMBER_ADD', targetId: userId, metadata: { username } }).catch(() => {});
      const [members, cfg] = await Promise.all([
        memberService.getMembers(guild.id),
        getGuildConfig(guild.id).catch(() => null),
      ]);
      await interaction.message?.edit(MemberView.render({ members, guild, cfg, page: 0 })).catch(() => null);
      return interaction.editReply({ content: '✅ Đã thêm thành viên.' });
    } catch (e) {
      log.error('MEMBER_ADD', guild.id, 'Lỗi thêm %s: %s', userId, e.message);
      return interaction.editReply(replyErrEdit(`Không thể thêm thành viên: ${e.message}`));
    }
  }, 'SetupMemberAddModalHandler')(interaction); }
}

module.exports = { SetupMemberAddModalHandler };
