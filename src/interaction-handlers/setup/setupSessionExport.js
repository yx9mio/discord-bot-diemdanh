'use strict';
const { AttachmentBuilder, MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const attendanceService = require('../../../services/attendanceService.js');
const sessionService = require('../../../services/sessionService.js');
const configService = require('../../../services/configService.js');
const log = require('../../../utils/logger.js');
const { buildCsvBuffer, buildCsvFilename } = require('../../../utils/csvHelper.js');
const { statusFull } = require('../../../utils/design-tokens.js');
const { wrapHandler } = require('../../../utils/error-boundary.js');
const { checkCooldown } = require('../../../utils/cooldown.js');

const PREFIX_EXPORT = 'setup:session:export:';

class SetupSessionExportHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (interaction.customId.startsWith(PREFIX_EXPORT)) return this.some();
    return this.none();
  }

  async run(interaction) {
    return wrapHandler(async (interaction) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!checkCooldown(interaction.user.id, 'sch_export', 1000)) return interaction.editReply({ content: '⏳ Vui lòng đợi một chút...' });

    const sessionId = interaction.customId.slice(PREFIX_EXPORT.length);
    const { guild } = interaction;

    const session = await sessionService.getActiveSession(guild.id);
    if (!session) {
      return interaction.editReply({ content: '🚫 Không có phiên nào đang mở để xuất.' });
    }

    const [attendances, cfg] = await Promise.all([
      attendanceService.getAttendances(sessionId),
      configService.getGuildConfig(guild.id).catch(() => null),
    ]);

    if (!attendances.length) {
      return interaction.editReply({ content: '📭 Phiên chưa có dữ liệu điểm danh.' });
    }

    const headers = ['user_id', 'username', 'status', 'status_label', 'checked_in_at', 'marked_by'];
    const rows = attendances.map(a => ({
      user_id: a.user_id,
      username: a.username ?? '',
      status: a.status,
      status_label: statusFull(a.status),
      checked_in_at: a.checked_in_at ?? '',
      marked_by: a.marked_by ?? '',
    }));

    const buf = buildCsvBuffer(headers, rows);
    const attachment = new AttachmentBuilder(buf, { name: buildCsvFilename(`diemdanh_${session.session_name ?? 'phien'}`) });

    return interaction.editReply({
      content: `✅ Xuất **${attendances.length}** dòng điểm danh từ phiên **${session.session_name ?? 'Phiên'}**.`,
      files: [attachment],
    });
  }, 'SetupSessionExportHandler')(interaction); }
}

module.exports = { SetupSessionExportHandler };
