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
  MessageFlags,
} = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const memberService = require('../../../services/memberService.js');
const { getGuildConfig } = require('../../../services/configService.js');
const log = require('../../../utils/logger.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { auditLog } = require('../../../utils/auditLog.js');
const { MemberView } = require('../../commands/setup/_views/_MemberView.js');
const { CUSTOM_ID } = MemberView;
const { wrapHandler } = require('../../../utils/error-boundary.js');
const { checkCooldown } = require('../../../utils/cooldown.js');

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
      interaction.customId === CUSTOM_ID.FILTER_ALL ||
      interaction.customId.startsWith(CUSTOM_ID.FILTER_PHAI_PREFIX) ||
      interaction.customId.startsWith(CUSTOM_ID.EDIT_PREFIX) ||
      interaction.customId.startsWith(CUSTOM_ID.DEL_PREFIX) ||
      interaction.customId.startsWith(CUSTOM_ID.DEL_CONFIRM_PREFIX) ||
      interaction.customId.startsWith(CUSTOM_ID.DEL_CANCEL_PREFIX)
    ) return this.some();
    return this.none();
  }

  async run(interaction) {
    return wrapHandler(async (interaction) => {
    const { guild, customId } = interaction;

    function _readFilterPhai(text) {
      const phaiM = text.match(/phai:(\d+)/);
      return phaiM ? phaiM[1] : '';
    }

    // ── Danh sách thành viên / navigation / filter ─────────────────────
    if (
      customId === CUSTOM_ID.MEMBER ||
      customId === CUSTOM_ID.PAGE_NEXT ||
      customId === CUSTOM_ID.PAGE_PREV ||
      customId === CUSTOM_ID.REFRESH ||
      customId === CUSTOM_ID.FILTER_ALL ||
      customId.startsWith(CUSTOM_ID.FILTER_PHAI_PREFIX)
    ) {
      if (!checkCooldown(interaction.user.id, 'mem_list', 1000)) {
        return interaction.reply({ content: '⏳ Vui lòng đợi một chút...', flags: MessageFlags.Ephemeral });
      }
      await interaction.deferUpdate();
      const footer = interaction.message?.embeds?.[0]?.footer?.text ?? '';
      let currentPage = 0;
      const m = footer.match(/Trang (\d+)\/(\d+)/);
      if (m) currentPage = parseInt(m[1], 10) - 1;

      let nextPage = currentPage;
      if (customId === CUSTOM_ID.PAGE_NEXT) nextPage++;
      if (customId === CUSTOM_ID.PAGE_PREV) nextPage--;

      const filterPhai = customId === CUSTOM_ID.FILTER_ALL
        ? ''
        : customId.startsWith(CUSTOM_ID.FILTER_PHAI_PREFIX)
          ? customId.slice(CUSTOM_ID.FILTER_PHAI_PREFIX.length)
          : _readFilterPhai(footer);

      const [members, cfg] = await Promise.all([
        memberService.getMembers(guild.id),
        getGuildConfig(guild.id),
      ]);
      return interaction.editReply(MemberView.render({ members, guild, cfg, page: nextPage, filterPhai }));
    }

    // ── Sửa thành viên ────────────────────────────────────────────────
    if (customId.startsWith(CUSTOM_ID.EDIT_PREFIX)) {
      const { ok } = await requireAdmin(interaction, { context: 'sửa thành viên', deferred: false });
      if (!ok) return;
      if (!checkCooldown(interaction.user.id, 'mem_edit', 5000)) {
        return interaction.reply({ content: '⏳ Vui lòng đợi trước khi thực hiện lại thao tác này.', flags: MessageFlags.Ephemeral });
      }
      const userId = customId.slice(CUSTOM_ID.EDIT_PREFIX.length);
      const member = await memberService.getMember(guild.id, userId);
      const { MemberView: MV } = require('../../commands/setup/_views/_MemberView.js');
      return interaction.showModal(MV.buildEditModal(member));
    }

    // ── Xoá thành viên (bước 1: confirm) ─────────────────────────────
    if (customId.startsWith(CUSTOM_ID.DEL_PREFIX) && !customId.startsWith(CUSTOM_ID.DEL_CONFIRM_PREFIX) && !customId.startsWith(CUSTOM_ID.DEL_CANCEL_PREFIX)) {
      if (!checkCooldown(interaction.user.id, 'mem_del', 5000)) {
        return interaction.reply({ content: '⏳ Vui lòng đợi một chút...', flags: MessageFlags.Ephemeral });
      }
      await interaction.deferUpdate();
      const { ok } = await requireAdmin(interaction, { context: 'xoá thành viên', deferred: true });
      if (!ok) return;
      const userId = customId.slice(CUSTOM_ID.DEL_PREFIX.length);
      const gMember = guild.members.cache.get(userId);
      const name = gMember?.displayName ?? `<@${userId}>`;
      return interaction.editReply({
        content: `⚠️ Xác nhận xoá thành viên **${name}** khỏi danh sách điểm danh?`,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`${CUSTOM_ID.DEL_CONFIRM_PREFIX}${userId}`).setLabel('Xác nhận xoá').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`${CUSTOM_ID.DEL_CANCEL_PREFIX}${userId}`).setLabel('Hủy').setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
    }

    // ── Xoá thành viên (bước 2: thực hiện) ───────────────────────────
    if (customId.startsWith(CUSTOM_ID.DEL_CONFIRM_PREFIX)) {
      if (!checkCooldown(interaction.user.id, 'mem_del_confirm', 5000)) {
        return interaction.reply({ content: '⏳ Vui lòng đợi một chút...', flags: MessageFlags.Ephemeral });
      }
      await interaction.deferUpdate();
      const { ok } = await requireAdmin(interaction, { context: 'xoá thành viên', deferred: true });
      if (!ok) return;
      const userId = customId.slice(CUSTOM_ID.DEL_CONFIRM_PREFIX.length);
      try {
        await memberService.deleteMember(guild.id, userId);
        auditLog({ guildId: guild.id, actorId: interaction.user.id, action: 'MEMBER_REMOVE', targetId: userId }).catch(() => {});
        const [members, cfg] = await Promise.all([
          memberService.getMembers(guild.id),
          getGuildConfig(guild.id),
        ]);
        return interaction.editReply(MemberView.render({ members, guild, cfg, page: 0 }));
      } catch (e) {
        log.error('MEMBER_DELETE', guild.id, 'Lỗi xoá %s: %s', userId, e.message);
        return interaction.editReply({ content: `❌ Không thể xoá: ${e.message}` });
      }
    }

    // ── Huỷ xoá ──────────────────────────────────────────────────────
    if (customId.startsWith(CUSTOM_ID.DEL_CANCEL_PREFIX)) {
      if (!checkCooldown(interaction.user.id, 'mem_del_cancel', 1000)) {
        return interaction.reply({ content: '⏳ Vui lòng đợi một chút...', flags: MessageFlags.Ephemeral });
      }
      await interaction.deferUpdate();
      const [members, cfg] = await Promise.all([
        memberService.getMembers(guild.id),
        getGuildConfig(guild.id),
      ]);
      return interaction.editReply(MemberView.render({ members, guild, cfg, page: 0 }));
    }

    // ── Reset streak (handled by setupResetStreak.js) ─────────────────
  }, 'SetupMemberHandler')(interaction); }
}

module.exports = { SetupMemberHandler };
