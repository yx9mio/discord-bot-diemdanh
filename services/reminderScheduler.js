// services/reminderScheduler.js
// Scan scheduled_sessions mỗi phút, gửi reminder + auto-open phiên đúng giờ.
// Hỗ trợ timezone per-guild (lưu trong guild_configs.timezone, IANA string).
// Hỗ trợ 2 mốc nhắc (reminder_1_min, reminder_2_min) và skip_until.
// Hỗ trợ auto-open cho cả recurring_weekly và one_time.
//
// [AUTO-OPEN] Khi minsToOpen === 0, tự động mở phiên điểm danh.
//   - one_time: deactivate schedule sau khi mở (is_active = false)
//   - recurring_weekly: set skip_until = tomorrow để tránh mở lại cùng ngày
//
// [BUG-C] Fix: cfg.log_channel_id → cfg.notification_channel_id (đúng column trong guild_configs)
// [BUG-E] Formula luxonWeekday % 7 đúng sẵn — không cần fix.
// [FIX-DB] Thay db.js → configService + scheduledService
'use strict';
const configService    = require('./configService.js');
const scheduledService = require('./scheduledService.js');
const sessionService   = require('./sessionService.js');
const log = require('../utils/logger.js');
const { DateTime } = require('luxon');
const { buildSessionEmbed } = require('../utils/_views/sessionView.js');
const { buildAttendanceSelectRow, buildSessionActionRow } = require('../utils/_views/rows.js');
const { startAutoRefresh, scheduleCloseTimer } = require('../utils/timers.js');

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

    if (sched.skip_until) {
      const skipUntil = DateTime.fromISO(sched.skip_until, { zone: tz });
      if (now < skipUntil) return;
    }

    // ── Auto-open khi đến giờ ────────────────────────────────────────────────
    if (minsToOpen === 0) {
      await autoOpenSession(guild, cfg, sched);
      return;
    }

    const remind1 = sched.reminder_1_min ?? 60;
    const remind2 = sched.reminder_2_min ?? 15;

    const shouldRemind = (minsToOpen === remind1) || (minsToOpen === remind2);
    if (!shouldRemind) return;

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

async function autoOpenSession(guild, cfg, sched) {
  try {
    const notifChannelId = sched.channel_id || cfg?.notification_channel_id;
    if (!notifChannelId) {
      log.warn('AUTO_OPEN', guild.id, 'Không có kênh thông báo, bỏ qua auto-open cho %s', sched.session_name);
      return;
    }
    const ch = await guild.channels.fetch(notifChannelId).catch(() => null);
    if (!ch) {
      log.warn('AUTO_OPEN', guild.id, 'Kênh %s không tìm thấy', notifChannelId);
      return;
    }

    // Kiểm tra không có phiên đang mở
    const activeSession = await sessionService.getActiveSession(guild.id);
    if (activeSession) {
      log.info('AUTO_OPEN', guild.id, 'Đã có phiên đang mở, bỏ qua auto-open');
      return;
    }

    // Compute auto_close_at from schedule's close_hour/close_minute
    let autoCloseAt = null;
    if (sched.close_hour != null && sched.close_minute != null) {
      const closeAt = DateTime.now().setZone(cfg.timezone ?? 'Asia/Ho_Chi_Minh')
        .set({ hour: sched.close_hour, minute: sched.close_minute, second: 0, millisecond: 0 });
      if (closeAt > DateTime.now().setZone(cfg.timezone ?? 'Asia/Ho_Chi_Minh')) {
        autoCloseAt = closeAt.toISO();
      }
    }

    const session = await sessionService.createSession({
      guild_id:      guild.id,
      session_name:  sched.session_name || 'Điểm danh',
      started_by:    guild.members.me?.id,
      auto_close_at: autoCloseAt,
      phai_role_ids: sched.phai_role_ids ?? [],
    });

    session.channel_id = ch.id;
    session.phai_role_icons = cfg?.phai_role_icons ?? {};
    await sessionService.updateSessionMessage(session.id, { channel_id: ch.id });

    const { embed: sessionEmbed, components } = buildSessionEmbed(guild, session, [], session.phai_role_ids ?? []);
    const selectRow = buildAttendanceSelectRow(true);
    const adminRows = buildSessionActionRow(true);
    const msg = await ch.send({
      embeds: [sessionEmbed],
      components: [selectRow, ...adminRows, ...components].slice(0, 5),
    });
    await sessionService.updateSessionMessage(session.id, { message_id: msg.id });

    if (cfg?.attendance_role_id) {
      await ch.send({
        content: `<@&${cfg.attendance_role_id}> Phiên điểm danh **${session.session_name}** đã tự động mở!`,
      }).catch(() => null);
    }

    startAutoRefresh(session.id, ch.id, msg.id, _client);

    if (session.auto_close_at) {
      const msLeft = new Date(session.auto_close_at).getTime() - Date.now();
      if (msLeft > 0) scheduleCloseTimer(_client, guild, session, ch.id, msLeft);
    }

    log.info('AUTO_OPEN', guild.id, 'Đã auto-open phiên: %s', session.session_name);

    // Deactivate schedule
    if (sched.type === 'one_time') {
      await scheduledService.deleteScheduledSession(guild.id, sched.id);
      log.info('AUTO_OPEN', guild.id, 'Đã xoá one-time schedule %s', sched.id);
    } else {
      // recurring: skip until tomorrow để tránh mở lại
      const tomorrow = DateTime.now().setZone(cfg.timezone ?? 'Asia/Ho_Chi_Minh').plus({ days: 1 }).startOf('day');
      await scheduledService.skipScheduledSession(sched.id, tomorrow.toISO());
      log.info('AUTO_OPEN', guild.id, 'Đã skip recurring schedule %s đến %s', sched.id, tomorrow.toISODate());
    }
  } catch (e) {
    log.error('AUTO_OPEN', guild.id, 'autoOpenSession thất bại: %s', e.message);
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

    if (sched.type === 'one_time') {
      // One-time: kiểm tra scheduled_date
      if (!sched.scheduled_date) return null;
      const today = now.toISODate();
      if (sched.scheduled_date !== today) return null;
      // Không check day_of_week cho one_time
    } else {
      // Recurring: kiểm tra day_of_week
      if (sched.day_of_week != null && (now.weekday % 7) !== sched.day_of_week) return null;
    }

    const target  = now.set({ hour: sched.hour, minute: sched.minute ?? 0, second: 0, millisecond: 0 });
    const diffMin = Math.round(target.diff(now, 'minutes').minutes);
    return diffMin >= 0 ? diffMin : null;
  } catch (_e) {
    return null;
  }
}

module.exports = { startReminderScheduler, getMinutesToOpen, autoOpenSession };
