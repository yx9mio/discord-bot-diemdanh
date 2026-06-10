'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { MessageFlags } = require('discord.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { replyConfirm, replyErrEdit } = require('../../../utils/embeds.js');
const sessionService = require('../../../services/sessionService.js');
const log = require('../../../utils/logger.js');

const PREFIX = 'setup:session:close:';

class SetupSessionCloseHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === 'setup:session:close') return this.some();
    if (id.startsWith(PREFIX)) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { ok } = await requireAdmin(interaction, { context: 'đóng phiên', deferred: true });
    if (!ok) return;

    const id = interaction.customId;
    const guild = interaction.guild;

    let session;
    if (id.startsWith(PREFIX)) {
      const sessionId = id.slice(PREFIX.length);
      session = await sessionService.getSessionByIdRaw(sessionId, guild.id);
    } else {
      session = await sessionService.getActiveSession(guild.id);
    }

    if (!session) {
      return interaction.editReply(replyErrEdit('Không tìm thấy phiên yêu cầu.'));
    }

    log.info('SESSION_CLOSE', guild.id,
      '%s yêu cầu đóng phiên "%s"', interaction.user.tag, session.session_name);

    return interaction.editReply(
      replyConfirm(
        `Bạn có chắc muốn đóng phiên **"${session.session_name}"**?\n> Hành động này không thể hoàn tác.`,
        'session:confirm_close',
        'session:cancel_close',
      ),
    );
  }
}

module.exports = { SetupSessionCloseHandler };
