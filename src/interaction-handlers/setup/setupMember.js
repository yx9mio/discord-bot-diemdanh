'use strict';
// interaction-handlers/setup/setupMember.js
// [MERGE] setupMembers.js đã được hợp nhất vào đây — xóa setupMembers.js
// [FIX-BUG-1]  Loại bỏ duplicate handler (setupMembers.js bị xóa)
// [FIX-BUG-2]  requireAdmin: truyền interaction, không phải member
// [FIX-BUG-3]  removeMember → deleteMember (tên hàm trong memberService)
// [FIX-PATH]   ../../../ → ../../../../
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const memberService = require('../../../services/memberService.js');
const log = require('../../../utils/logger.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { MemberView } = require('../../commands/setup/_views/_MemberView.js');
const { CUSTOM_ID } = MemberView;

class SetupMemberHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (
      interaction.customId === CUSTOM_ID.MEMBER ||
      interaction.customId === CUSTOM_ID.PAGE_NEXT ||
      interaction.customId === CUSTOM_ID.PAGE_PREV ||
      interaction.customId === CUSTOM_ID.REFRESH ||
      interaction.customId.startsWith(CUSTOM_ID.EDIT_PREFIX) ||
      interaction.customId.startsWith(CUSTOM_ID.DEL_PREFIX) ||
      interaction.customId.startsWith(CUSTOM_ID.DEL_CONFIRM_PREFIX) ||
      interaction.customId.startsWith(CUSTOM_ID.DEL_CANCEL_PREFIX) ||
      interaction.customId.startsWith(CUSTOM_ID.RESET_PREFIX)
    ) return this.some();
    return this.none();
  }

  async run(interaction) {
    const { guild, customId } = interaction;

    // ── Danh sách thành viên / navigation ─────────────────────────────
    if (
      customId === CUSTOM_ID.MEMBER ||
      customId === CUSTOM_ID.PAGE_NEXT ||
      customId === CUSTOM_ID.PAGE_PREV ||
      customId === CUSTOM_ID.REFRESH
    ) {
      await interaction.deferUpdate();
      const footer = interaction.message?.embeds?.[0]?.footer?.text ?? '';
      let currentPage = 0;
      const m = footer.match(/Trang (\d+)\/(\d+)/);
      if (m) currentPage = parseInt(m[1], 10) - 1;

      let nextPage = currentPage;
      if (customId === CUSTOM_ID.PAGE_NEXT) nextPage++;
      if (customId === CUSTOM_ID.PAGE_PREV) nextPage--;

      const members = await memberService.getMembers(guild.id);
      return interaction.editReply(MemberView.render({ members, guild, page: nextPage }));
    }

    // ── Sửa thành viên ────────────────────────────────────────────────
    if (customId.startsWith(CUSTOM_ID.EDIT_PREFIX)) {
      const { ok } = await requireAdmin(interaction, { context: 'sửa thành viên', deferred: false });
      if (!ok) return;
      const userId = customId.slice(CUSTOM_ID.EDIT_PREFIX.length);
      const member = await memberService.getMember(guild.id, userId);
      const { MemberView: MV } = require('../../commands/setup/_views/_MemberView.js');
      return interaction.showModal(MV.buildEditModal(member));
    }

    // ── Xoá thành viên (bước 1: confirm) ─────────────────────────────
    if (customId.startsWith(CUSTOM_ID.DEL_PREFIX) && !customId.startsWith(CUSTOM_ID.DEL_CONFIRM_PREFIX) && !customId.startsWith(CUSTOM_ID.DEL_CANCEL_PREFIX)) {
      const { ok } = await requireAdmin(interaction, { context: 'xoá thành viên', deferred: false });
      if (!ok) return;
      await interaction.deferUpdate();
      const userId = customId.slice(CUSTOM_ID.DEL_PREFIX.length);
      const gMember = guild.members.cache.get(userId);
      const name = gMember?.displayName ?? `<@${userId}>`;
      return interaction.editReply({
        content: `⚠️ Xác nhận xoá thành viên **${name}** khỏi danh sách điểm danh?`,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`${CUSTOM_ID.DEL_CONFIRM_PREFIX}${userId}`).setLabel('Xác nhận xoá').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`${CUSTOM_ID.DEL_CANCEL_PREFIX}${userId}`).setLabel('Huỷ').setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
    }

    // ── Xoá thành viên (bước 2: thực hiện) ───────────────────────────
    if (customId.startsWith(CUSTOM_ID.DEL_CONFIRM_PREFIX)) {
      const { ok } = await requireAdmin(interaction, { context: 'xoá thành viên', deferred: false });
      if (!ok) return;
      await interaction.deferUpdate();
      const userId = customId.slice(CUSTOM_ID.DEL_CONFIRM_PREFIX.length);
      try {
        await memberService.deleteMember(guild.id, userId);
        const members = await memberService.getMembers(guild.id);
        return interaction.editReply(MemberView.render({ members, guild, page: 0 }));
      } catch (e) {
        log.error('MEMBER_DELETE', guild.id, 'Lỗi xoá %s: %s', userId, e.message);
        return interaction.editReply({ content: `❌ Không thể xoá: ${e.message}` });
      }
    }

    // ── Huỷ xoá ──────────────────────────────────────────────────────
    if (customId.startsWith(CUSTOM_ID.DEL_CANCEL_PREFIX)) {
      await interaction.deferUpdate();
      const members = await memberService.getMembers(guild.id);
      return interaction.editReply(MemberView.render({ members, guild, page: 0 }));
    }

    // ── Reset streak ──────────────────────────────────────────────────
    if (customId.startsWith(CUSTOM_ID.RESET_PREFIX)) {
      const { ok } = await requireAdmin(interaction, { context: 'reset streak', deferred: false });
      if (!ok) return;
      await interaction.deferUpdate();
      const userId = customId.slice(CUSTOM_ID.RESET_PREFIX.length);
      try {
        await memberService.resetStreak(guild.id, userId);
        const members = await memberService.getMembers(guild.id);
        return interaction.editReply(MemberView.render({ members, guild, page: 0 }));
      } catch (e) {
        log.error('MEMBER_STREAK_RESET', guild.id, 'Lỗi reset streak %s: %s', userId, e.message);
        return interaction.editReply({ content: `❌ Không thể reset streak: ${e.message}` });
      }
    }
  }
}

module.exports = { SetupMemberHandler };
