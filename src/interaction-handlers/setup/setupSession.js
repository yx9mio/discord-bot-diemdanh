'use strict';
const { AttachmentBuilder, MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const sessionService = require('../../../services/sessionService.js');
const attendanceService = require('../../../services/attendanceService.js');
const { getGuildConfig } = require('../../../services/configService.js');
const { getMembers } = require('../../../services/memberService.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { replyErrEdit } = require('../../../utils/embeds.js');
const { buildCsvBuffer, buildCsvFilename } = require('../../../utils/csvHelper.js');
const log = require('../../../utils/logger.js');

const PREFIX_REFRESH = 'setup:session:refresh';
const PREFIX_EXPORT  = 'setup:session:export:';

class SetupSessionHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === 'setup:session') return this.some();
    if (id === PREFIX_REFRESH) return this.some();
    if (id.startsWith(PREFIX_EXPORT)) return this.some();
    return this.none();
  }

  async run(interaction) {
    const { customId, guild } = interaction;

    if (customId.startsWith(PREFIX_EXPORT)) {
      const sessionId = customId.slice(PREFIX_EXPORT.length);
      return this._handleExport(interaction, guild, sessionId);
    }

    await interaction.deferUpdate();

    const [allSessions, cfg, members] = await Promise.all([
      sessionService.getActiveSessions(guild.id),
      getGuildConfig(guild.id),
      getMembers(guild.id),
    ]);
    const { SessionView } = require('../../commands/setup/_views/_SessionView.js');
    return interaction.editReply(SessionView.render({ sessions: allSessions, guild, cfg, members }));
  }

  async _handleExport(interaction, guild, sessionId) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { ok } = await requireAdmin(interaction, { context: 'xuất CSV', deferred: true });
    if (!ok) return;

    let session;
    if (sessionId) {
      session = await sessionService.getSessionByIdRaw(sessionId, guild.id);
    } else {
      session = await sessionService.getActiveSession(guild.id);
    }
    if (!session) return interaction.editReply(replyErrEdit('\uD83D\uDEAB Không tìm thấy phiên yêu cầu.'));

    const attended = await attendanceService.getAttendances(session.id);
    if (!attended.length) return interaction.editReply(replyErrEdit('\uD83D\uDEAB Chưa có ai điểm danh trong phiên này.'));

    try {
      const csvBuffer = buildCsvBuffer(attended);
      const filename = buildCsvFilename(session.session_name ?? session.id, session.id);
      const attachment = new AttachmentBuilder(csvBuffer, { name: filename });
      return interaction.editReply({
        content: `📄 File CSV điểm danh phiên **${session.session_name}** (${attended.length} bản ghi)`,
        files: [attachment],
      });
    } catch (e) {
      log.error('EXPORT_CSV', guild.id, 'Lỗi tạo CSV: %s', e.message);
      return interaction.editReply(replyErrEdit('❌ Không thể tạo file CSV, thử lại sau.'));
    }
  }
}

module.exports = { SetupSessionHandler };
