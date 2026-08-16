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

class SetupSessionSelectHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.SelectMenu });
  }

  parse(interaction) {
    if (interaction.customId === SessionView.CUSTOM_ID.SELECT) return this.some();
    return this.none();
  }

  async run(interaction) {
    return wrapHandler(async (interaction) => {
    await interaction.deferUpdate();
    if (!checkCooldown(interaction.user.id, 'setup_session_select', 1000)) {
      return interaction.editReply({ content: '⏳ Vui lòng đợi một chút trước khi thực hiện hành động này.' });
    }
    const { guild } = interaction;
    const sessionId = interaction.values?.[0];
    if (!sessionId) return interaction.editReply({ content: '⚠️ Không xác định được Kỳ được chọn.' });

    try {
      const [allSessions, cfg, members] = await Promise.all([
        sessionService.getActiveSessions(guild.id),
        getGuildConfig(guild.id),
        getMembers(guild.id),
      ]);
      const session = allSessions.find(s => s.id === sessionId) ?? allSessions[0] ?? null;
      const attendances = session
        ? await attendanceService.getAttendances(session.id)
        : [];
      return interaction.editReply(SessionView.renderSummary({
        session, guild, cfg, members, attendances,
        sessionCount: allSessions.length, sessions: allSessions,
      }));
    } catch (e) {
      log.error('SETUP_SESSION_SELECT', guild.id, 'Chọn Kỳ thất bại: %s', e.message);
      return interaction.editReply({ content: '❌ Không thể tải dữ liệu Bang Chiến, thử lại sau.' });
    }
  }, 'SetupSessionSelectHandler')(interaction); }
}

module.exports = { SetupSessionSelectHandler };