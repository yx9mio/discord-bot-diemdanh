// services/reminderScheduler.js
// Scan scheduled_sessions mỗi phút, gửi reminder vào kênh thông báo trước giờ mở phiên.
// Hỗ trợ timezone per-guild (lưu trong guild_configs.timezone, IANA string).
// Hỗ trợ 2 mốc nhắc (reminder_1_min, reminder_2_min) và skip_until.
/* global process */
'use strict';
const db  = require('../db.js');
const log = require('../utils/logger.js');
const { DateTime } = require('luxon');

let _client = null;

function startReminderScheduler(client) {
  _client = client;
  setInterval(runReminders, 60_000);
  log.info('REMINDER', null, 'Reminder scheduler started');
}

async function runReminders() {
  try {
    const guilds = _client?.guilds?.cache;
    if (!guilds) return;
    for (const [, guild] of guilds) {
      await processGuildReminders(guild);
    }
  } catch (e) {
    log.error('REMINDER', null, 'runReminders error: %s', e.message);
  }
}

async function processGuildReminders(guild) {
  try {
    const cfg = await db.getConfig(guild.id);
    if (!cfg?.channel_id) return;

    const tz       = cfg.timezone ?? 'Asia/Ho_Chi_Minh';
    const now      = DateTime.now().setZone(tz);
    const schedules = await db.getScheduledSessions(guild.id);
    if (!schedules?.length) return;

    for (const sched of schedules) {
      await processOneReminder(guild, cfg, sched, now, tz);
    }
  } catch (e) {
    log.error('REMINDER', guild.id, 'processGuildReminders: %s', e.message);
  }
}

async function processOneReminder(guild, cfg, sched, now, tz) {
  try {
    const minsToOpen = getMinutesToOpen(sched, now, tz);
    if (minsToOpen === null) return;

    const remind1 = sched.reminder_1_min ?? 60;
    const remind2 = sched.reminder_2_min ?? 15;

    const shouldRemind = (minsToOpen === remind1) || (minsToOpen === remind2);
    if (!shouldRemind) return;

    if (sched.skip_until) {
      const skipUntil = DateTime.fromISO(sched.skip_until, { zone: tz });
      if (now < skipUntil) return;
    }

    const ch = await guild.channels.fetch(cfg.channel_id).catch(() => null);
    if (!ch) return;

    await ch.send(`⏰ **Nhắc lịch:** Phiên **${sched.session_name}** sẽ mở sau **${minsToOpen} phút**.`);
    log.info('REMINDER', guild.id, 'Sent %dmin reminder for %s', minsToOpen, sched.session_name);
  } catch (e) {
    log.error('REMINDER', guild.id, 'processOneReminder: %s', e.message);
  }
}

function getMinutesToOpen(sched, now, tz) {
  try {
    if (!sched.open_hour && sched.open_hour !== 0) return null;
    const target = now.set({ hour: sched.open_hour, minute: sched.open_minute ?? 0, second: 0, millisecond: 0 });
    const diffMin = Math.round(target.diff(now, 'minutes').minutes);
    return diffMin >= 0 ? diffMin : null;
  } catch (_e) {
    return null;
  }
}

module.exports = { startReminderScheduler };
