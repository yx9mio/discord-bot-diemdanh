// services/reminderScheduler.js
// Scan scheduled_sessions mỗi phút, gửi reminder vào kênh thông báo trước giờ mở phiên.
// Hỗ trợ timezone per-guild (lưu trong guild_configs.timezone, IANA string).
// Hỗ trợ 2 mốc nhắc (reminder_1_min, reminder_2_min) và skip_until.
//
// [BUG-C] Fix: cfg.log_channel_id → cfg.notification_channel_id (đúng column trong guild_configs)
// [BUG-E] Fix: Luxon weekday T7=7 → 7%7=0 collide với CN=0 trong schema.
//         Correct mapping: Luxon(1=T2..7=CN) → schema(0=CN,1=T2..6=T7)
//         Formula: (luxonWeekday % 7) cho T2-T6 đúng, nhưng T7(7%7=0) sai.
//         Fix: dùng luxonWeekday === 7 ? 6 : luxonWeekday-1 (shift -1, CN special-case)
//         Thực ra đơn giản hơn: schemaDay = luxonWeekday % 7  → Luxon CN=7→0 ✓, T2=1→1 ✓... T7=7→0 ✗
//         Correct: schemaDay = luxonWeekday === 7 ? 0 : luxonWeekday
//         Wait — schema: 0=CN,1=T2,2=T3,3=T4,4=T5,5=T6,6=T7
//                 Luxon:  1=T2,2=T3,3=T4,4=T5,5=T6,6=T7,7=CN
//         Mapping: Luxon1→schema1, Lx2→2, Lx3→3, Lx4→4, Lx5→5, Lx6→6, Lx7→0
//         Formula: schemaDay = luxonWeekday % 7   ← Lx7%7=0=CN ✓, Lx6%7=6=T7 ✓, Lx1%7=1=T2 ✓
//         BUG: code cũ dùng `(now.weekday % 7) !== sched.day_of_week` — đây thực ra ĐÚNG cho T7/CN.
//         Nhưng vấn đề thực tế: Luxon weekday 6=T7 → 6%7=6=schema T7 ✓, Luxon 7=CN → 7%7=0=schema CN ✓
//         Vậy formula % 7 đúng. Bug thực sự là ở chỗ Luxon `weekday` property trả về 1-7
//         với T2=1, CN=7. 7%7=0 → schema CN=0 ✓. 6%7=6 → schema T7=6 ✓.
//         Re-audit: formula cũ `(now.weekday % 7) !== sched.day_of_week` ĐÚNG về mặt toán học.
//         BUG-E thực sự: doc comment sai gây confuse, nhưng logic đúng. Không cần fix formula.
//         Tuy nhiên BUG-C (log_channel_id) vẫn là bug thực sự cần fix.
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
    // [BUG-C] Dùng notification_channel_id thay vì log_channel_id (không tồn tại trong guild_configs)
    if (!cfg?.notification_channel_id) return;

    const tz        = cfg.timezone ?? 'Asia/Ho_Chi_Minh';
    const now       = DateTime.now().setZone(tz);
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

    // [BUG-C] Dùng notification_channel_id
    const ch = await guild.channels.fetch(cfg.notification_channel_id).catch(() => null);
    if (!ch) return;

    await ch.send(`⏰ **Nhắc lịch:** Phiên **${sched.session_name}** sẽ mở sau **${minsToOpen} phút**.`);
    log.info('REMINDER', guild.id, 'Sent %dmin reminder for %s', minsToOpen, sched.session_name);
  } catch (e) {
    log.error('REMINDER', guild.id, 'processOneReminder: %s', e.message);
  }
}

// [BUG-E] Kiểm tra lại mapping Luxon weekday → schema day_of_week:
//   Luxon: 1=T2, 2=T3, 3=T4, 4=T5, 5=T6, 6=T7, 7=CN
//   Schema: 0=CN, 1=T2, 2=T3, 3=T4, 4=T5, 5=T6, 6=T7
//   Formula đúng: luxonWeekday % 7 → Lx1%7=1=T2 ✓, Lx6%7=6=T7 ✓, Lx7%7=0=CN ✓
//   Không cần thay đổi formula — đã đúng sẵn.
function getMinutesToOpen(sched, now) {
  try {
    if (sched.hour == null) return null;
    // Mapping Luxon weekday (1=T2..7=CN) sang schema (0=CN,1=T2..6=T7): luxon % 7
    if (sched.day_of_week != null && (now.weekday % 7) !== sched.day_of_week) return null;
    const target  = now.set({ hour: sched.hour, minute: sched.minute ?? 0, second: 0, millisecond: 0 });
    const diffMin = Math.round(target.diff(now, 'minutes').minutes);
    return diffMin >= 0 ? diffMin : null;
  } catch (_e) {
    return null;
  }
}

module.exports = { startReminderScheduler };
