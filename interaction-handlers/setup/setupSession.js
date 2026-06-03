// interaction-handlers/setup/setupSession.js
// Handles: setup:session:close
// Mở confirm dialog đóng phiên hiện tại từ Home dashboard.
// (Commit 3: chỉ xử lý close. Commit 4+ sẽ thêm broadcast, refresh nâng cao.)
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const db = require('../../db.js');
const { requireAdmin } = require('../../utils/permissions.js');
const { replyConfirm, replyErrEdit } = require('../../utils/embeds.js');
const HomeView = require('../../src/commands/setup/_HomeView.js').HomeView;
const { CUSTOM_ID } = HomeView;

class SetupSessionHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (interaction.customId === CUSTOM_ID.SESSION) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { ok } = await requireAdmin(interaction, { context: 'đóng phiên từ /setup' });
    if (!ok) return;
    const { guild } = interaction;
    const session = await db.getActiveSession(guild.id);
    if (!session) {
      return interaction.editReply(replyErrEdit('🚫 Không có phiên nào đang mở.'));
    }
    return interaction.editReply(
      replyConfirm(
        `Bạn có chắc muốn đóng phiên **"${session.session_name}"**?\n> Hành động này không thể hoàn tác.`,
        'session:confirm_close',
        'session:cancel_close',
      ),
    );
  }
}

module.exports = { SetupSessionHandler };
