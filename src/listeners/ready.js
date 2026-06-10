'use strict';
// listeners/ready.js
// Phase 2 fix: restore active-session timers khi bot restart
// + khởi động reminder scheduler
// [BUG-READY] buildSummaryEmbed là async — phải await, không thì gửi [object Promise]
const { Listener, Events } = require('@sapphire/framework');
const { getActiveSession, closeSession } = require('../../services/sessionService.js');
const { getAttendances } = require('../../services/attendanceService.js');
const log = require('../../utils/logger.js');
const { datHenGioDong, startAutoRefresh } = require('../../utils/timers.js');
const { startReminderScheduler } = require('../../services/reminderScheduler.js');

class ReadyListener extends Listener {
  constructor(context) {
    super(context, { event: Events.ClientReady, once: true });
  }

  async run(client) {
    log.info('READY', null, `Đăng nhập: ${client.user.tag} · ${client.guilds.cache.size} server(s)`);

    let restored = 0;
    for (const guild of client.guilds.cache.values()) {
      try {
        const session = await getActiveSession(guild.id);
        if (!session) continue;

        // [BUG-10] Luôn restore auto-refresh cho mọi session active
        if (session.channel_id && session.message_id) {
          const ch = await guild.channels.fetch(session.channel_id).catch(() => null);
          if (ch) {
            startAutoRefresh(session.id, session.channel_id, session.message_id, client);
            restored++;
          }
        }

        if (session.auto_close_at) {
          const msLeft = new Date(session.auto_close_at).getTime() - Date.now();
          if (msLeft <= 0) {
            log.warn('READY', guild.id, 'Phiên %s quá giờ, đóng ngay.', session.session_name);
            const { ketThucPhien, thongBaoHuyHieu, voHieuHoaNutDiemDanh } = require('../../utils/session.js');
            const { buildSummaryEmbed } = require('../../utils/embeds.js');
            try {
              const { stopAutoRefresh } = require('../../utils/timers.js');
              stopAutoRefresh(session.id);
              await closeSession(session.id);
              const attended = await getAttendances(session.id);
              const ch2 = session.channel_id
                ? await guild.channels.fetch(session.channel_id).catch(() => null)
                : null;
              if (ch2) {
                const statsMap = await ketThucPhien(guild, session, attended);
                await voHieuHoaNutDiemDanh(client, ch2, session, attended);
                // [BUG-READY] await buildSummaryEmbed — hàm async, thiếu await → gửi Promise
                await ch2.send({ embeds: [await buildSummaryEmbed(session, attended, guild, session.phai_role_ids ?? [])] });
                await thongBaoHuyHieu(guild, ch2, guild.id, session.id, attended, statsMap);
              }
            } catch (e) {
              log.error('READY', guild.id, 'Đóng phiên quá giờ thất bại: %s', e.message);
            }
          } else {
            const ch3 = session.channel_id
              ? await guild.channels.fetch(session.channel_id).catch(() => null)
              : null;
            if (ch3) {
              await datHenGioDong(client, guild, session, session.channel_id, msLeft);
              log.info('READY', guild.id, 'Restored timer: %s (~%dm còn lại)',
                session.session_name, Math.round(msLeft / 60_000));
            }
          }
        }
      } catch (e) {
        log.error('READY', guild.id, 'Lỗi restore timer: %s', e.message);
      }
    }
    if (restored) log.info('READY', null, 'Đã restore %d auto-refresh timer(s).', restored);

    startReminderScheduler(client);
  }
}

module.exports = { ReadyListener };
