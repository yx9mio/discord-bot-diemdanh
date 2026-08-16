'use strict';
const { Listener, Events } = require('@sapphire/framework');
const sessionService    = require('../../services/sessionService.js');
const attendanceService = require('../../services/attendanceService.js');
const configService     = require('../../services/configService.js');
const { buildSessionEmbed, buildBoardRow } = require('../../utils/embeds.js');
const { startAutoRefresh } = require('../../utils/timers.js');
const log = require('../../utils/logger.js');

// Chống loop: bỏ qua nếu board vừa được phục hồi bị xóa ngay trong 15s
const REPOST_COOLDOWN_MS = 15_000;
const lastRepost = new Map();

class MessageDeleteListener extends Listener {
  constructor(context) { super(context, { event: Events.MessageDelete }); }

  async run(message) {
    if (!message.guild) return;
    try {
      const session = await sessionService.getSessionByMessageId(message.id);
      if (!session) return;

      if (!session.is_active) {
        log.warn(`[MessageDelete] phiên=${session.id} guild=${message.guild.id} (đã đóng — không phục hồi)`);
        return;
      }
      if (session.message_id !== message.id) return;

      const last = lastRepost.get(session.id) ?? 0;
      if (Date.now() - last < REPOST_COOLDOWN_MS) return;

      // [UX-P5] Phục hồi board bị xóa: re-post + cập nhật message_id + bật lại auto-refresh
      const guild = message.guild;
      const ch = await guild.channels.fetch(session.channel_id ?? message.channelId).catch(() => null);
      if (!ch) return;

      await guild.members.fetch().catch(() => {});
      await guild.roles.fetch().catch(() => {});
      const cfg = await configService.getGuildConfig(guild.id).catch(() => null);
      const attended = await attendanceService.getAttendances(session.id);
      const phaiIds = session.phai_role_ids?.length
        ? session.phai_role_ids
        : cfg?.phai_role_ids ?? [];
      const { embed } = buildSessionEmbed(guild, session, attended, phaiIds, false, 1, cfg?.phai_role_icons ?? null, true, { showList: false });
      const boardRows = buildBoardRow(true);

      const postBoard = async () => {
        const msg = await ch.send({ embeds: [embed], components: [boardRows] });
        await sessionService.updateSessionMessage(session.id, { message_id: msg.id });
        return msg;
      };

      let msg = await postBoard();
      // [BUG-FIX] Race: msg mới bị xóa giữa send và updateSessionMessage →
      // DB trỏ vào id đã xóa, board mất vĩnh viễn. Verify + gửi lại 1 lần.
      const stillThere = await ch.messages.fetch(msg.id).catch(() => null);
      if (!stillThere) {
        const retry = await postBoard().catch(() => null);
        if (!retry) {
          log.warn('MESSAGE_DELETE', guild.id, 'Board mới lại bị xóa ngay, bỏ qua (phiên %s)', session.id);
          return;
        }
        msg = retry;
      }

      startAutoRefresh(session.id, ch.id, msg.id, message.client);

      // [BUG-FIX] Prune entries cũ để Map không phình vô hạn
      for (const [sid, ts] of lastRepost) {
        if (Date.now() - ts > REPOST_COOLDOWN_MS) lastRepost.delete(sid);
      }
      lastRepost.set(session.id, Date.now());
      log.info('MESSAGE_DELETE', guild.id, 'Đã phục hồi board phiên %s → msg %s', session.id, msg.id);
    } catch (err) {
      log.error('[MessageDelete]', err);
    }
  }
}

module.exports = { MessageDeleteListener };