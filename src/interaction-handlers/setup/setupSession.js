// interaction-handlers/setup/setupSession.js
// Handles: setup:session:close
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { MessageFlags } = require('discord.js');
const sessionService = require('../../../../services/sessionService.js');
const { getGuildConfig } = require('../../../../services/configService.js');
const { getMembers } = require('../../../../services/memberService.js');
const { HomeView } = require('../../commands/setup/_views/_HomeView.js');
const { requireAdmin } = require('../../../../utils/permissions.js');
const log = require('../../../../utils/logger.js');

class SetupSessionHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (interaction.customId === 'setup:session:close') return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { ok } = await requireAdmin(interaction, { context: 'đóng phiên', deferred: true });
    if (!ok) return;

    const { guild } = interaction;
    const session = await sessionService.getActiveSession(guild.id);
    if (!session) {
      return interaction.editReply({ content: '❌ Không có phiên nào đang mở.' });
    }

    try {
      await sessionService.closeSession(guild.id, session.id);
      log.info('SESSION_CLOSE', guild.id, 'Đóng phiên %s', session.id);
    } catch (e) {
      log.error('SESSION_CLOSE', guild.id, 'closeSession thất bại: %s', e.message);
      return interaction.editReply({ content: '❌ Không thể đóng phiên, thử lại sau.' });
    }

    await interaction.editReply({ content: '✅ Đã đóng phiên điểm danh.' });

    try {
      const [cfg, schedules, members] = await Promise.all([
        getGuildConfig(guild.id),
        require('../../../../services/scheduledService.js').getScheduledSessions(guild.id),
        getMembers(guild.id),
      ]);
      await interaction.message.edit(HomeView.render({ guild, cfg, schedules, members, session: null }));
    } catch (e) {
      log.warn('SESSION_CLOSE', guild.id, 'Không thể refresh dashboard: %s', e.message);
    }
  }
}

module.exports = { SetupSessionHandler };
