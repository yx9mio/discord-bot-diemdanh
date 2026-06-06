// interaction-handlers/setup/setupResetStreak.js
// Handles: setup:mem:reset:all + confirm/cancel
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const memberService = require('../../../../services/memberService.js');
const { requireAdmin } = require('../../../../utils/permissions.js');
const log = require('../../../../utils/logger.js');

const IDS = {
  RESET_ALL:         'setup:mem:reset:all',
  RESET_ALL_CONFIRM: 'setup:mem:reset:all:confirm',
  RESET_ALL_CANCEL:  'setup:mem:reset:all:cancel',
};

class SetupResetStreakHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === IDS.RESET_ALL || id === IDS.RESET_ALL_CONFIRM || id === IDS.RESET_ALL_CANCEL)
      return this.some();
    return this.none();
  }

  async run(interaction) {
    const { customId, guild } = interaction;

    if (customId === IDS.RESET_ALL) {
      await interaction.deferUpdate();
      return interaction.editReply({
        content: '⚠️ Bạn có chắc muốn reset streak của **tất cả thành viên**?',
        embeds: [], components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(IDS.RESET_ALL_CONFIRM).setLabel('✅ Xác nhận reset tất cả').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(IDS.RESET_ALL_CANCEL).setLabel('↩️ Hủy').setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
    }

    if (customId === IDS.RESET_ALL_CONFIRM) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { ok } = await requireAdmin(interaction, { context: 'reset tất cả streak', deferred: true });
      if (!ok) return;
      try {
        const members = await memberService.getMembers(guild.id);
        await memberService.batchResetStreak(guild.id, members.map(m => m.user_id));
        log.info('RESET_ALL', guild.id, 'Reset streak %d thành viên', members.length);
        return interaction.editReply({ content: `✅ Đã reset streak cho **${members.length}** thành viên.` });
      } catch (e) {
        log.error('RESET_ALL', guild.id, 'batchResetStreak thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể reset streak, thử lại sau.' });
      }
    }

    if (customId === IDS.RESET_ALL_CANCEL) {
      await interaction.deferUpdate();
      const members = await memberService.getMembers(guild.id).catch(() => []);
      const { MemberView } = require('../../commands/setup/_views/_MemberView.js');
      return interaction.editReply({ ...MemberView.render({ members, page: 0, guild }), content: undefined });
    }
  }
}

module.exports = { SetupResetStreakHandler };
