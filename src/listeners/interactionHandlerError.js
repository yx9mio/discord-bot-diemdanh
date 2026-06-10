'use strict';
// [FIX] Khi handler throw sau deferUpdate/deferReply:
// interaction.deferred=true → reply() bị Discord từ chối → user thấy timeout im lặng
// Fix: dùng editReply nếu đã deferred/replied, reply nếu chưa
// [FIX-2] Guard 10062 (Unknown Interaction) và 40060 (Already Acknowledged)
//         — xảy ra khi bot restart và Discord replay interaction cũ.
//         Bỏ qua hoàn toàn, không cần reply vì Discord-side đã timeout.
const { Listener, Events } = require('@sapphire/framework');
const { replyErr, replyErrEdit } = require('../../utils/embeds.js');

// Error codes từ Discord API mà ta muốn bỏ qua im lặng
const STALE_CODES = new Set([10062, 40060]);

class InteractionHandlerErrorListener extends Listener {
  constructor(context) { super(context, { event: Events.InteractionHandlerError }); }

  async run(error, { interaction }) {
    // [FIX-2] Stale interaction sau restart — bỏ qua, không log as error
    if (STALE_CODES.has(error?.code)) {
      this.container.logger.warn(
        '[InteractionHandlerError] Stale interaction bỏ qua (code %d): %s',
        error.code,
        interaction?.id ?? 'unknown',
      );
      return;
    }

    this.container.logger.error('[InteractionHandlerError]', error);
    const msg = error instanceof Error ? error.message : 'Có lỗi xảy ra.';
    if (!interaction.isRepliable()) return;
    try {
      if (interaction.deferred || interaction.replied) {
        // [FIX] Đã defer/reply → dùng editReply, xoá embed/components cũ
        await interaction.editReply({ content: `❌ ${msg}`, embeds: [], components: [] });
      } else {
        await interaction.reply(replyErr(msg));
      }
    } catch (replyErr) {
      // Token hết hạn (>15 phút), unknown interaction, hoặc đã replied — bỏ qua
      if (!STALE_CODES.has(replyErr?.code)) {
        this.container.logger.warn('[InteractionHandlerError] Không thể reply: %s', replyErr?.message);
      }
    }
  }
}
module.exports = { InteractionHandlerErrorListener };
