'use strict';
const { Listener, Events, ApplicationCommandRegistry } = require('@sapphire/framework');
const { getActiveSession, getActiveSessions, closeSession } = require('../../services/sessionService.js');
const { getAttendances } = require('../../services/attendanceService.js');
const scheduledService = require('../../services/scheduledService.js');
const configService = require('../../services/configService.js');
const { syncGuildEmojis } = require('../../services/guildEmojiService.js');
const log = require('../../utils/logger.js');
const { scheduleCloseTimer, startAutoRefresh, stopAutoRefresh } = require('../../utils/timers.js');
const { startReminderScheduler, getMinutesToOpen, autoOpenSession } = require('../../services/reminderScheduler.js');
const { DateTime } = require('luxon');

class ReadyListener extends Listener {
  constructor(context) {
    super(context, { event: Events.ClientReady, once: true });
  }

  async run(client) {
    log.info('READY', null, `Đăng nhập: ${client.user.tag} · ${client.guilds.cache.size} server(s)`);

    let restored = 0;
    for (const guild of client.guilds.cache.values()) {
      // ── Đồng bộ emoji cache ─────────────────────────────────────────────
      try { await syncGuildEmojis(guild); } catch (e) {
        log.warn('READY', guild.id, 'Emoji sync fail, fallback Supabase load: %s', e.message);
        const { loadGuildEmojiCache } = require('../../services/guildEmojiService.js');
        try { await loadGuildEmojiCache(guild.id); } catch (e2) { log.warn('READY', guild.id, 'Supabase load also fail: %s', e2.message); }
      }

      // ── Catch-up: auto-open các one-time schedule đáng lẽ đã mở ─────────
      const cfg = await configService.getGuildConfig(guild.id).catch(() => null);
      if (cfg?.notification_channel_id) {
        const tz = cfg.timezone ?? 'Asia/Ho_Chi_Minh';
        const now = DateTime.now().setZone(tz);
        const schedules = await scheduledService.getScheduledSessions(guild.id);
        for (const sched of schedules) {
          if (sched.type !== 'one_time' || !sched.scheduled_date) continue;
          const today = now.toISODate();
          if (sched.scheduled_date !== today) continue;
          if (getMinutesToOpen(sched, now) !== null) continue;
          const alreadyActive = await getActiveSession(guild.id).catch(() => null);
          if (alreadyActive) continue;
          await autoOpenSession(guild, cfg, sched);
        }
      }

      // ── Restore active sessions ────────────────────────────────────────────
      const sessions = await getActiveSessions(guild.id);
      if (!sessions.length) continue;

      log.info('READY', guild.id, 'Phục hồi %d phiên đang mở', sessions.length);

      for (const session of sessions) {
        try {
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
              const { endSession, announceBadges, disableAttendanceUI } = require('../../utils/session.js');
              const { buildSummaryEmbed } = require('../../utils/embeds.js');
              try {
                stopAutoRefresh(session.id);
                await closeSession(session.id, guild.id);
                const attended = await getAttendances(session.id);
                const ch2 = session.channel_id
                  ? await guild.channels.fetch(session.channel_id).catch(() => null)
                  : null;
                if (ch2) {
                  const statsMap = await endSession(guild, session, attended);
                  await disableAttendanceUI(client, ch2, session, attended);
                  await ch2.send({ embeds: [await buildSummaryEmbed(session, attended, guild, session.phai_role_ids ?? [])] });
                  await announceBadges(guild, ch2, guild.id, session.id, attended, statsMap);
                }
              } catch (e) {
                log.error('READY', guild.id, 'Đóng phiên quá giờ thất bại: %s', e.message);
              }
            } else {
              const ch3 = session.channel_id
                ? await guild.channels.fetch(session.channel_id).catch(() => null)
                : null;
              if (ch3) {
                await scheduleCloseTimer(client, guild, session, session.channel_id, msLeft);
                log.info('READY', guild.id, 'Restored timer: %s (~%dm còn lại)',
                  session.session_name, Math.round(msLeft / 60_000));
              }
            }
          }
        } catch (e) {
          log.error('READY', guild.id, 'Lỗi restore phiên %s: %s', session.id, e.message);
        }
      }
    }
    if (restored) log.info('READY', null, 'Đã restore %d auto-refresh timer(s).', restored);

    if (!process.env.GUILD_ID) {
      try {
        await registerGuildCommands(client);
      } catch (e) {
        log.error('READY', null, 'Guild command registration fail: %s', e.message);
      }
    }

    startReminderScheduler(client);
  }
}

async function registerGuildCommands(client) {
  log.info('CMD_REG', null, 'GUILD_ID not set — registering commands on all guilds...');

  // Build command data từ Sapphire command store
  const commandStore = client.stores.get('commands');
  const allData = [];
  for (const cmd of commandStore.values()) {
    try {
      const registry = new ApplicationCommandRegistry(cmd.name);
      if (typeof cmd.registerApplicationCommands === 'function') {
        await cmd.registerApplicationCommands(registry);
      }
      if (registry.apiCalls?.length) {
        for (const call of registry.apiCalls) {
          if (call.builtData) allData.push(call.builtData);
        }
      }
    } catch (e) {
      log.warn('CMD_REG', null, 'Skip %s: %s', cmd.name, e.message);
    }
  }

  if (!allData.length) {
    log.warn('CMD_REG', null, 'No command data to register');
    return;
  }

  let ok = 0;
  for (const guild of client.guilds.cache.values()) {
    try {
      await guild.commands.set(allData);
      ok++;
    } catch (e) {
      log.warn('CMD_REG', guild.id, 'Failed: %s', e.message);
    }
  }
  log.info('CMD_REG', null, 'Registered %d commands on %d/%d guilds', allData.length, ok, client.guilds.cache.size);
}

module.exports = { ReadyListener };
