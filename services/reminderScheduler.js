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
const { tryAcquireLeadership, startHeartbeat, stopHeartbeat } = require('../utils/schedulerLock.js');
const { DateTime } = require('luxon');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { buildSessionEmbed } = require('../utils/_views/sessionView.js');
const { buildAttendanceSelectRow, buildSessionActionRow } = require('../utils/_views/rows.js');
const { startAutoRefresh, scheduleCloseTimer } = require('../utils/timers.js');

let _client = null;
let _running = false;

function startReminderScheduler(client) {
  _client = client;
  setInterval(runReminders, 60_000);
  log.info('REMINDER', null, 'Reminder scheduler started');
}

async function runReminders() {
  if (_running) {
    log.warn('REMINDER', null, 'Previous tick still running, skipping');
    return;
  }

  if (!await tryAcquireLeadership('scheduler_leader')) {
    log.debug('REMINDER', null, 'Distributed lock held by another instance, skipping tick');
    return;
  }

  _running = true;
  startHeartbeat('scheduler_leader');
  try {
    const guilds = _client?.guilds?.cache;
    if (!guilds) return;
    for (const [, guild] of guilds) {
      await processGuildReminders(guild);
    }
  } catch (e) {
    log.error('REMINDER', null, 'runReminders error: %s', e.message);
  } finally {
    stopHeartbeat();
    _running = false;
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

    // Gửi vào kênh thông báo
    const ch = await guild.channels.fetch(cfg.notification_channel_id).catch(() => null);
    if (ch) {
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('⏰ Nhắc lịch điểm danh')
        .setDescription(`Kỳ **${sched.session_name}** sẽ mở sau **${minsToOpen} phút**.`)
        .addFields(
          { name: '🕐 Giờ mở', value: `${String(sched.hour).padStart(2, '0')}:${String(sched.minute ?? 0).padStart(2, '0')}`, inline: true },
          { name: '📅 Loại', value: sched.type === 'one_time' ? 'Một lần' : 'Hàng tuần', inline: true },
        )
        .setTimestamp();
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`reminder:confirm:${sched.id}`)
          .setLabel('Có mặt')
          .setEmoji('✅')
          .setStyle(ButtonStyle.Success),
      );
      await ch.send({ embeds: [embed], components: [confirmRow] }).catch(() => {});
    }

    // Gửi DM cho thành viên đủ điều kiện
    const dmMsg = `⏰ **Nhắc lịch:** Kỳ **${sched.session_name}** sẽ mở sau **${minsToOpen} phút**.`;
    await _sendDmReminders(guild, cfg, sched, dmMsg);

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

    // Distributed guard: atomic deactivate schedule để tránh multi-instance duplicate
    if (sched.type === 'one_time') {
      const deleted = await scheduledService.deleteScheduledSession(guild.id, sched.id);
      if (!deleted) {
        log.info('AUTO_OPEN', guild.id, 'Schedule %s đã được xử lý bởi instance khác, bỏ qua', sched.id);
        return;
      }
    } else {
      const tomorrow = DateTime.now().setZone(cfg.timezone ?? 'Asia/Ho_Chi_Minh').plus({ days: 1 }).startOf('day');
      const updated = await scheduledService.skipScheduledSession(sched.id, tomorrow.toISO());
      if (!updated) {
        log.info('AUTO_OPEN', guild.id, 'Schedule %s đã được skip bởi instance khác, bỏ qua', sched.id);
        return;
      }
    }

    // Kiểm tra không có phiên đang mở (L2 check sau khi deactivate)
    const activeSession = await sessionService.getActiveSession(guild.id);
    if (activeSession) {
      log.info('AUTO_OPEN', guild.id, 'Đã có phiên đang mở, bỏ qua auto-open');
      return;
    }

    // Compute auto_close_at from schedule's close_day_of_week / close_hour / close_minute
    let autoCloseAt = null;
    if (sched.close_hour != null && sched.close_minute != null) {
      const now = DateTime.now().setZone(cfg.timezone ?? 'Asia/Ho_Chi_Minh');
      const startAt = now.set({ hour: sched.hour, minute: sched.minute, second: 0, millisecond: 0 });
      let closeAt = startAt.set({ hour: sched.close_hour, minute: sched.close_minute, second: 0, millisecond: 0 });
      if (sched.close_day_of_week != null) {
        let dayOffset = (sched.close_day_of_week - sched.day_of_week + 7) % 7;
        if (dayOffset === 0 && closeAt <= startAt) dayOffset = 7;
        closeAt = closeAt.plus({ days: dayOffset });
      } else if (closeAt <= startAt) {
        closeAt = closeAt.plus({ days: 1 });
      }
      autoCloseAt = closeAt.toISO();
    }

    const session = await sessionService.createSession({
      guild_id:      guild.id,
      session_name:  sched.session_name || 'Điểm danh',
      started_by:    guild.members.me?.id,
      auto_close_at: autoCloseAt,
      phai_role_ids: sched.phai_role_ids ?? [],
    });

    session.channel_id = ch.id;
    await sessionService.updateSessionMessage(session.id, { channel_id: ch.id });

    const { embed: sessionEmbed, components } = buildSessionEmbed(guild, session, [], cfg?.phai_role_ids ?? [], false, 1, cfg?.phai_role_icons ?? null);
    const selectRow = buildAttendanceSelectRow(true);
    const adminRows = buildSessionActionRow(true);
    const msg = await ch.send({
      embeds: [sessionEmbed],
      components: [selectRow, ...adminRows, ...components].slice(0, 5),
    });
    await sessionService.updateSessionMessage(session.id, { message_id: msg.id });

    if (cfg?.attendance_role_id) {
      await ch.send({
        content: `<@&${cfg.attendance_role_id}> Kỳ điểm danh **${session.session_name}** đã tự động mở!`,
      }).catch(() => null);
    }

    startAutoRefresh(session.id, ch.id, msg.id, _client);

    if (session.auto_close_at) {
      const msLeft = new Date(session.auto_close_at).getTime() - Date.now();
      if (msLeft > 0) scheduleCloseTimer(_client, guild, session, ch.id, msLeft);
    }

    log.info('AUTO_OPEN', guild.id, 'Đã auto-open phiên: %s', session.session_name);
  } catch (e) {
    log.error('AUTO_OPEN', guild.id, 'autoOpenSession thất bại: %s', e.message);
  }
}

async function _sendDmReminders(guild, cfg, sched, msg) {
  try {
    if (guild.members.cache.size === 0) {
      await guild.members.fetch().catch(() => {});
      if (guild.members.cache.size === 0) {
        log.warn('REMINDER_DM', guild.id, 'Members cache trống, bỏ qua gửi DM');
        return;
      }
    }
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
