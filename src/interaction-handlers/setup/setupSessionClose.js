'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { MessageFlags } = require('discord.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { replyConfirm, replyErrEdit } = require('../../../utils/embeds.js');
const sessionService = require('../../../services/sessionService.js');
const log = require('../../../utils/logger.js');
const { wrapHandler } = require('../../../utils/error-boundary.js');
const { checkCooldown } = require('../../../utils/cooldown.js');

const PREFIX = 'setup:session:close:';
const CLOSE_ALL = 'setup:session:close:all';

class SetupSessionCloseHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === CLOSE_ALL)         return this.some();
    if (id === 'setup:session:close') return this.some();
    if (id.startsWith(PREFIX) && id !== CLOSE_ALL) return this.some();
    return this.none();
  }

  async run(interaction) {
    return wrapHandler(async (interaction) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { ok } = await requireAdmin(interaction, { context: 'đóng phiên', deferred: true });
    if (!ok) return;
    if (!checkCooldown(interaction.user.id, 'setup_session_close', 5000)) {
      return interaction.editReply({ content: '⏳ Vui lòng đợi một chút trước khi thực hiện hành động này.' });
    }

    const id = interaction.customId;
    const guild = interaction.guild;

    try {
      if (id === CLOSE_ALL) {
        const sessions = await sessionService.getActiveSessions(guild.id);
        if (!sessions.length) return interaction.editReply(replyErrEdit('Không có Bang Chiến nào đang mở.'));

        log.info('SESSION_CLOSE_ALL', guild.id,
          '%s yêu cầu đóng tất cả %d phiên', interaction.user.tag, sessions.length);

        return interaction.editReply(
          replyConfirm(
            `Bạn có chắc muốn đóng **tất cả ${sessions.length} Bang Chiến** đang mở?\n> Hành động này không thể hoàn tác.`,
            'session:confirm_close:all',
            'session:cancel_close:all',
          ),
        );
      }

      let session;
      if (id.startsWith(PREFIX)) {
        const sessionId = id.slice(PREFIX.length);
        session = await sessionService.getSessionByIdRaw(sessionId, guild.id);
      } else {
        session = await sessionService.getActiveSession(guild.id);
      }

      if (!session) {
        return interaction.editReply(replyErrEdit('Không tìm thấy Bang Chiến yêu cầu.'));
      }

      log.info('SESSION_CLOSE', guild.id,
        '%s yêu cầu đóng phiên "%s"', interaction.user.tag, session.session_name);

      return interaction.editReply(
        replyConfirm(
          `Bạn có chắc muốn đóng Bang Chiến **"${session.session_name}"**?\n> Hành động này không thể hoàn tác.`,
          'session:confirm_close',
          'session:cancel_close',
        ),
      );
    } catch (e) {
      log.error('SESSION_CLOSE', guild.id, 'Kiểm tra phiên thất bại: %s', e.message);
      return interaction.editReply(replyErrEdit('Không thể kiểm tra phiên, thử lại sau.'));
    }
  }, 'SetupSessionCloseHandler')(interaction); }
}

module.exports = { SetupSessionCloseHandler };
