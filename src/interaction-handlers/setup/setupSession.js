'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const sessionService = require('../../../services/sessionService.js');
const attendanceService = require('../../../services/attendanceService.js');
const { getGuildConfig } = require('../../../services/configService.js');
const { getMembers } = require('../../../services/memberService.js');

const PREFIX_REFRESH = 'setup:session:refresh';
const PREFIX_DETAIL  = 'setup:session:detail:';

class SetupSessionHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === 'setup:session') return this.some();
    if (id === PREFIX_REFRESH) return this.some();
    if (id.startsWith(PREFIX_DETAIL)) return this.some();
    return this.none();
  }

  async run(interaction) {
    const { customId, guild, component } = interaction;

    let detailId = null;
    if (customId.startsWith(PREFIX_DETAIL)) {
      const sessionId = customId.slice(PREFIX_DETAIL.length);
      const wasExpanded = component?.label?.startsWith('▴') ?? false;
      detailId = wasExpanded ? null : sessionId;
    }

    await interaction.deferUpdate();

    const [allSessions, cfg, members] = await Promise.all([
      sessionService.getActiveSessions(guild.id),
      getGuildConfig(guild.id),
      getMembers(guild.id),
    ]);

    const sessionsWithStats = await Promise.all(allSessions.map(async (s) => {
      const atts = await attendanceService.getAttendances(s.id).catch(() => []);
      const eligible = s.eligible_member_ids?.length ?? 0;
      return {
        ...s,
        eligible_count:  eligible,
        attended_count:  atts.filter(a => a.status === 'tham_gia' || a.status === 'tre').length,
        late_count:      atts.filter(a => a.status === 'tre').length,
        absent_count:    atts.filter(a => a.status === 'khong_tham_gia').length,
        created_by:      s.started_by,
        created_at:      s.started_at,
      };
    }));

    const { SessionView } = require('../../commands/setup/_views/_SessionView.js');
    return interaction.editReply(SessionView.render({ sessions: sessionsWithStats, guild, cfg, members, detailId }));
  }
}

module.exports = { SetupSessionHandler };
