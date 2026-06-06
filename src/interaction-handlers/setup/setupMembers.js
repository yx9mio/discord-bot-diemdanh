// src/interaction-handlers/setup/setupMembers.js
// Handles: setup:mem (entry), pagination PAGE_NEXT/PAGE_PREV, REFRESH, ADD, REMOVE
// [NEW] File bị mất — tạo lại
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const memberService = require('../../../../services/memberService.js');
const { requireAdmin } = require('../../../../utils/permissions.js');
const log = require('../../../../utils/logger.js');
const { MemberView } = require('../../commands/setup/_views/_MemberView.js');
const { CUSTOM_ID } = MemberView;

const HANDLED = new Set([
  'setup:mem',
  CUSTOM_ID.PAGE_NEXT,
  CUSTOM_ID.PAGE_PREV,
  CUSTOM_ID.REFRESH,
  CUSTOM_ID.ADD,
]);

class SetupMembersHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (HANDLED.has(id)) return this.some();
    if (id?.startsWith(CUSTOM_ID.REMOVE_PREFIX ?? 'setup:mem:remove:')) return this.some();
    if (id?.startsWith(CUSTOM_ID.EDIT_PREFIX  ?? 'setup:mem:edit:'))   return this.some();
    if (id?.startsWith(CUSTOM_ID.RESET_PREFIX ?? 'setup:mem:reset:'))  return this.some();
    return this.none();
  }

  async run(interaction) {
    const { guild, customId } = interaction;

    // ── Entry / Refresh → về trang đầu ───────────────────────────────
    if (customId === 'setup:mem' || customId === CUSTOM_ID.REFRESH) {
      await interaction.deferUpdate();
      const members = await memberService.getMembers(guild.id).catch(() => []);
      return interaction.editReply(MemberView.render({ guild, members, page: 0 }));
    }

    // ── Pagination ────────────────────────────────────────────────────
    if (customId === CUSTOM_ID.PAGE_NEXT || customId === CUSTOM_ID.PAGE_PREV) {
      await interaction.deferUpdate();
      let currentPage = 0;
      try {
        const footer = interaction.message?.embeds?.[0]?.footer?.text ?? '';
        const m = footer.match(/Trang (\d+)\/(\d+)/);
        if (m) currentPage = parseInt(m[1], 10) - 1;
      } catch { /* ignore */ }
      const members = await memberService.getMembers(guild.id).catch(() => []);
      const totalPages = Math.max(1, Math.ceil(members.length / (MemberView.PAGE_SIZE ?? 10)));
      const newPage = customId === CUSTOM_ID.PAGE_NEXT
        ? Math.min(totalPages - 1, currentPage + 1)
        : Math.max(0, currentPage - 1);
      return interaction.editReply(MemberView.render({ guild, members, page: newPage }));
    }

    // ── Thêm thành viên → mở modal ────────────────────────────────────
    if (customId === CUSTOM_ID.ADD) {
      return interaction.showModal(
        new ModalBuilder()
          .setCustomId('setup:mem:add:modal')
          .setTitle('Thêm thành viên')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('user_id')
                .setLabel('User ID (chuỗi số Discord)').setStyle(TextInputStyle.Short)
                .setRequired(true).setMaxLength(20).setPlaceholder('123456789012345678'),
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('nickname')
                .setLabel('Nickname (tuỳ chọn)').setStyle(TextInputStyle.Short)
                .setRequired(false).setMaxLength(50),
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('phong_ban')
                .setLabel('Phòng ban (tuỳ chọn)').setStyle(TextInputStyle.Short)
                .setRequired(false).setMaxLength(50),
            ),
          ),
      );
    }

    // ── Sửa thành viên → mở modal ─────────────────────────────────────
    if (customId.startsWith(CUSTOM_ID.EDIT_PREFIX ?? 'setup:mem:edit:')) {
      const userId = customId.slice((CUSTOM_ID.EDIT_PREFIX ?? 'setup:mem:edit:').length);
      const members = await memberService.getMembers(guild.id).catch(() => []);
      const target = members.find(m => m.user_id === userId);
      return interaction.showModal(
        new ModalBuilder()
          .setCustomId(`setup:mem:edit:modal:${userId}`)
          .setTitle('Sửa thông tin thành viên')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('username')
                .setLabel('Username').setStyle(TextInputStyle.Short)
                .setRequired(false).setMaxLength(50)
                .setValue(target?.username ?? ''),
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('phong_ban')
                .setLabel('Phòng ban').setStyle(TextInputStyle.Short)
                .setRequired(false).setMaxLength(50)
                .setValue(target?.phong_ban ?? ''),
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('ghi_chu')
                .setLabel('Ghi chú').setStyle(TextInputStyle.Short)
                .setRequired(false).setMaxLength(100)
                .setValue(target?.ghi_chu ?? ''),
            ),
          ),
      );
    }

    // ── Xoá thành viên ────────────────────────────────────────────────
    if (customId.startsWith(CUSTOM_ID.REMOVE_PREFIX ?? 'setup:mem:remove:')) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { ok } = await requireAdmin(interaction, { context: 'xoá thành viên', deferred: true });
      if (!ok) return;
      const userId = customId.slice((CUSTOM_ID.REMOVE_PREFIX ?? 'setup:mem:remove:').length);
      try {
        await memberService.removeMember(guild.id, userId);
        log.info('MEM_REMOVE', guild.id, 'Xoá thành viên %s', userId);
        const members = await memberService.getMembers(guild.id).catch(() => []);
        await interaction.editReply({ content: `✅ Đã xoá <@${userId}> khỏi danh sách.` });
        await interaction.message?.edit(MemberView.render({ guild, members, page: 0 })).catch(() => null);
      } catch (e) {
        log.error('MEM_REMOVE', guild.id, 'removeMember thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể xoá thành viên, thử lại sau.' });
      }
    }
  }
}

module.exports = { SetupMembersHandler };
