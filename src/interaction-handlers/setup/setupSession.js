'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const sessionService = require('../../../services/sessionService.js');
const attendanceService = require('../../../services/attendanceService.js');
const { getGuildConfig } = require('../../../services/configService.js');
const { getMembers } = require('../../../services/memberService.js');
const log = require('../../../utils/logger.js');
const { wrapHandler } = require('../../../utils/error-boundary.js');
const { checkCooldown } = require('../../../utils/cooldown.js');

const { SessionView } = require('../../commands/setup/_views/_SessionView.js');

class SetupSessionHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (['setup:session', 'setup:session:refresh', 'setup:session:roster',
         'setup:session:details', 'setup:session:back',
         'setup:session:roster:prev', 'setup:session:roster:next'].includes(id)) {
      return this.some();
    }
    return this.none();
  }

  async run(interaction) {
    return wrapHandler(async (interaction) => {
    const { customId, guild } = interaction;
    await interaction.deferUpdate();
    if (!checkCooldown(interaction.user.id, 'setup_session', 1000)) {
      return interaction.editReply({ content: '⏳ Vui lòng đợi một chút trước khi thực hiện hành động này.' });
    }

    try {
      const [allSessions, cfg, members] = await Promise.all([
        sessionService.getActiveSessions(guild.id),
        getGuildConfig(guild.id),
        getMembers(guild.id),
      ]);

      const session = allSessions[0] ?? null;
      const attendances = session
        ? await attendanceService.getAttendances(session.id)
        : [];

      if (customId === 'setup:session:refresh') {
        const ctx = SessionView.parseFooter(interaction.message?.embeds?.[0]?.footer);
        if (ctx.ctx === 'roster') {
          return interaction.editReply(SessionView.renderRoster({ session, guild, attendances, page: ctx.page }));
        }
        if (ctx.ctx === 'details') {
          return interaction.editReply(SessionView.renderDetails({ session, guild, members, attendances, cfg }));
        }
        return interaction.editReply(SessionView.renderSummary({ session, guild, cfg, members, attendances }));
      }

      if (customId === 'setup:session:back') {
        return interaction.editReply(SessionView.renderSummary({ session, guild, cfg, members, attendances }));
      }

      if (customId === 'setup:session:roster') {
        return interaction.editReply(SessionView.renderRoster({ session, guild, attendances, page: 0 }));
      }

      if (customId === 'setup:session:details') {
        return interaction.editReply(SessionView.renderDetails({ session, guild, members, attendances, cfg }));
      }

      if (customId === 'setup:session:roster:prev' || customId === 'setup:session:roster:next') {
        const ctx = SessionView.parseFooter(interaction.message?.embeds?.[0]?.footer);
        const page = customId === 'setup:session:roster:prev' ? ctx.page - 1 : ctx.page + 1;
        return interaction.editReply(SessionView.renderRoster({ session, guild, attendances, page }));
      }

      return interaction.editReply(SessionView.renderSummary({ session, guild, cfg, members, attendances }));
    } catch (e) {
      log.error('SETUP_SESSION', guild.id, 'Session load thất bại: %s', e.message);
      return interaction.editReply({ content: '❌ Không thể tải dữ liệu Bang Chiến, thử lại sau.' });
    }
  }, 'SetupSessionHandler')(interaction); }
}

module.exports = { SetupSessionHandler };
