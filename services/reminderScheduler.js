// services/reminderScheduler.js
// Scan scheduled_sessions mỗi phút, gửi reminder vào kênh thông báo trước giờ mở phiên.
// Hỗ trợ timezone per-guild (lưu trong guild_configs.timezone, IANA string).
// Hỗ trợ 2 mốc nhắc (reminder_1_min, reminder_2_min) và skip_until.
//
// [BUG-C] Fix: cfg.log_channel_id → cfg.notification_channel_id (đúng column trong guild_configs)
// [BUG-E] Formula luxonWeekday % 7 đúng sẵn — không cần fix.
// [FIX-DB] Thay db.js → configService + scheduledService
'use strict';
const configService    = require('./configService.js');
const scheduledService = require('./scheduledService.js');
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
    const cfg = await configService.getGuildConfig(guild.id); // [#27] getConfig → getGuildConfig
    // [BUG-C] Dùng notification_channel_id thay vì log_channel_id (không tồn tại trong guild_configs)
    if (!cfg?.notification_channel_id) return;

    const tz        = cfg.timezone ?? 'Asia/Ho_Chi_Minh';
    const now       = DateTime.now().setZone(tz);
    const schedules = await scheduledService.getScheduledSessions(guild.id);
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
    if (sched.reminder_enabled === false) return;
    const minsToOpen = getMinutesToOpen(sched, now);
    if (minsToOpen === null) return;

    const remind1 = sched.reminder_1_min ?? 60;
    const remind2 = sched.reminder_2_min ?? 15;

    const shouldRemind = (minsToOpen === remind1) || (minsToOpen === remind2);
    if (!shouldRemind) return;

    if (sched.skip_until) {
      const skipUntil = DateTime.fromISO(sched.skip_until, { zone: tz });
      if (now < skipUntil) return;
    }

    const msg = `⏰ **Nhắc lịch:** Phiên **${sched.session_name}** sẽ mở sau **${minsToOpen} phút**.`;

    // Gửi vào kênh thông báo
    const ch = await guild.channels.fetch(cfg.notification_channel_id).catch(() => null);
    if (ch) {
      await ch.send(msg).catch(() => {});
    }

    // Gửi DM cho thành viên đủ điều kiện
    await _sendDmReminders(guild, cfg, sched, msg);

    log.info('REMINDER', guild.id, 'Sent %dmin reminder for %s', minsToOpen, sched.session_name);
  } catch (e) {
    log.error('REMINDER', guild.id, 'processOneReminder: %s', e.message);
  }
}

async function _sendDmReminders(guild, cfg, sched, msg) {
  try {
    await guild.members.fetch().catch(() => {});
    const targetIds = new Set();

    // Ưu tiên: allowed_role_id → phai_role_ids → attendance_role_id → tất cả
    if (sched.allowed_role_id) {
      const role = guild.roles.cache.get(sched.allowed_role_id);
      if (role) role.members.forEach(m => targetIds.add(m.id));
    }
    if (targetIds.size === 0 && sched.phai_role_ids?.length) {
      for (const rid of sched.phai_role_ids) {
        const role = guild.roles.cache.get(rid);
        if (role) role.members.forEach(m => targetIds.add(m.id));
      }
    }
    if (targetIds.size === 0 && cfg.attendance_role_id) {
      const role = guild.roles.cache.get(cfg.attendance_role_id);
      if (role) role.members.forEach(m => targetIds.add(m.id));
    }
    if (targetIds.size === 0) {
      guild.members.cache.forEach(m => { if (!m.user.bot) targetIds.add(m.id); });
    }

    let sent = 0;
    for (const uid of targetIds) {
      const member = guild.members.cache.get(uid);
      if (!member) continue;
      try {
        await member.send(msg);
        sent++;
      } catch {} // DM tắt hoặc blocked
    }
    if (sent > 0) {
      log.info('REMINDER_DM', guild.id, 'Đã gửi DM nhắc cho %d/%d thành viên', sent, targetIds.size);
    }
  } catch (e) {
    log.warn('REMINDER_DM', guild.id, 'Lỗi gửi DM: %s', e.message);
  }
}

function getMinutesToOpen(sched, now) {
  try {
    if (sched.hour == null) return null;
    if (sched.day_of_week != null && (now.weekday % 7) !== sched.day_of_week) return null;
    const target  = now.set({ hour: sched.hour, minute: sched.minute ?? 0, second: 0, millisecond: 0 });
    const diffMin = Math.round(target.diff(now, 'minutes').minutes);
    return diffMin >= 0 ? diffMin : null;
  } catch (_e) {
    return null;
  }
}

module.exports = { startReminderScheduler };
