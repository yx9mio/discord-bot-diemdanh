'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { MessageFlags } = require('discord.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { replyConfirm, replyErrEdit } = require('../../../utils/embeds.js');
const sessionService = require('../../../services/sessionService.js');
const log = require('../../../utils/logger.js');
const { wrapHandler } = require('../../../utils/error-boundary.js');
const { checkCooldown } = require('../../../utils/cooldown.js');

const PREFIX = 'setup:session:cancel:';

class SetupSessionCancelHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === 'setup:session:cancel' || id.startsWith(PREFIX)) return this.some();
    return this.none();
  }

  async run(interaction) {
    return wrapHandler(async (interaction) => {
    if (!checkCooldown(interaction.user.id, 'setup_session_cancel', 5000)) {
      return interaction.reply({ content: '⏳ Vui lòng đợi một chút trước khi thực hiện hành động này.', flags: MessageFlags.Ephemeral });
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { ok } = await requireAdmin(interaction, { context: 'hủy phiên', deferred: true });
    if (!ok) return;

    const id = interaction.customId;
    const guild = interaction.guild;

    try {
      const sessionId = id === 'setup:session:cancel'
        ? (await sessionService.getActiveSession(guild.id))?.id
        : id.slice(PREFIX.length);

      const session = sessionId
        ? await sessionService.getSessionByIdRaw(sessionId, guild.id)
        : null;

      if (!session) {
        return interaction.editReply(replyErrEdit('Không tìm thấy Bang Chiến yêu cầu.'));
      }
      if (!session.is_active) {
        return interaction.editReply(replyErrEdit(`Bang Chiến **"${session.session_name}"** không còn mở.`));
      }

      log.info('SESSION_CANCEL', guild.id,
        '%s yêu cầu hủy phiên "%s"', interaction.user.tag, session.session_name);

      return interaction.editReply(
        replyConfirm(
          `🗑️ Bạn có chắc muốn **hủy** Bang Chiến **"${session.session_name}"**?\n\n` +
          '> • Ngăn mọi thao tác điểm danh trên Kỳ này.\n' +
          '> • Không tính dữ liệu Kỳ này vào thống kê.\n' +
          '> • Giữ log trong nhật ký quản trị.\n\n' +
          'Hành động này **không thể hoàn tác**.',
          `setup:session:confirm:cancel:${session.id}`,
          'setup:session:cancel_cancel',
        ),
      );
    } catch (e) {
      log.error('SESSION_CANCEL', guild.id, 'Kiểm tra phiên thất bại: %s', e.message);
      return interaction.editReply(replyErrEdit('Không thể kiểm tra phiên, thử lại sau.'));
    }
  }, 'SetupSessionCancelHandler')(interaction); }
}

module.exports = { SetupSessionCancelHandler };