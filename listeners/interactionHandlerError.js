'use strict';
// [FIX] Khi handler throw sau deferUpdate/deferReply:
// interaction.deferred=true → reply() bị Discord từ chối → user thấy timeout im lặng
// Fix: dùng editReply nếu đã deferred/replied, reply nếu chưa
const { Listener, Events } = require('@sapphire/framework');
const { replyErr, replyErrEdit } = require('../utils/embeds.js');

class InteractionHandlerErrorListener extends Listener {
  constructor(context) { super(context, { event: Events.InteractionHandlerError }); }

  async run(error, { interaction }) {
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
    } catch {
      // Token hết hạn (>15 phút) hoặc unknown interaction — bỏ qua
    }
  }
}
module.exports = { InteractionHandlerErrorListener };
