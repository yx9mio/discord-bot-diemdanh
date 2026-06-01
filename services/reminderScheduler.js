// services/reminderScheduler.js
// Scan scheduled_sessions mỗi phút, gửi reminder vào kênh thông báo trước giờ mở phiên.
// Hỗ trợ timezone per-guild (lưu trong guild_configs.timezone, IANA string).
// Hỗ trợ 2 mốc nhắc (reminder_1_min, reminder_2_min) và skip_until.
'use strict';
const db  = require('../db.js');
const log = require('../utils/logger.js');

// ── Constants ──────────────────────────────────────────────────────────────

const TICK_MS          = 60_000;  // 1 phút
const WINDOW_TOLERANCE = 90_000;  // ±90s quanh đúng thời điểm nhắc
const DEFAULT_TZ       = 'Asia/Ho_Chi_Minh';

const sentCache = new Set();

// ── Helpers ────────────────────────────────────────────────────────────────

function msUntilNextOpen(lich, timezone) {
  const tz  = timezone || DEFAULT_TZ;
  const now = new Date();

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const get = (type) => parts.find(p => p.type === type)?.value;

  const todayDow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(get('weekday'));
  const year     = parseInt(get('year'),  10);
  const month    = parseInt(get('month'), 10) - 1;
  const day      = parseInt(get('day'),   10);

  let daysAhead = lich.day_of_week - todayDow;
  if (daysAhead < 0) daysAhead += 7;

  const localMidnight = new Date(`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}T00:00:00`);
  const tzOffset = getTzOffsetMs(tz, now);
  const candidateUtc = new Date(
    localMidnight.getTime()
    + daysAhead * 86_400_000
    + lich.hour   * 3_600_000
    + lich.minute * 60_000
    - tzOffset
  );

  if (candidateUtc.getTime() <= now.getTime()) {
    candidateUtc.setDate(candidateUtc.getDate() + 7);
  }

  return candidateUtc.getTime() - now.getTime();
}

function getTzOffsetMs(timezone, date) {
  const utcStr   = new Date(date).toLocaleString('en-US', { timeZone: 'UTC' });
  const localStr = new Date(date).toLocaleString('en-US', { timeZone: timezone });
  return new Date(localStr) - new Date(utcStr);
}

function cacheKey(guildId, lichId, minutesBefore, timezone) {
  const tz = timezone || DEFAULT_TZ;
  const d  = new Date();
  const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
  return `${guildId}:${lichId}:${minutesBefore}:${dateStr}`;
}

// ── Tick ───────────────────────────────────────────────────────────────────

async function tick(client) {
  for (const guild of client.guilds.cache.values()) {
    try {
      const cfg       = await db.getConfig(guild.id);
      const tz        = cfg?.timezone || DEFAULT_TZ;
      const notifChId = cfg?.notification_channel_id ?? cfg?.channel_id;
      if (!notifChId) continue;

      const lichList = await db.getScheduledSessions(guild.id);
      if (!lichList.length) continue;

      const now = Date.now();

      for (const lich of lichList) {
        if (!lich.reminder_enabled) continue;

        // Bỏ qua nếu skip_until chưa qua
        if (lich.skip_until && new Date(lich.skip_until).getTime() > now) continue;

        const msUntil = msUntilNextOpen(lich, tz);
        const openTs  = Math.floor((now + msUntil) / 1000);

        // 2 mốc nhắc: reminder_1_min (xa hơn) và reminder_2_min (gần hơn)
        for (const minutesBefore of [lich.reminder_1_min ?? 30, lich.reminder_2_min ?? 10]) {
          if (!minutesBefore) continue;
          const key = cacheKey(guild.id, lich.id, minutesBefore, tz);
          if (sentCache.has(key)) continue;

          const target = minutesBefore * 60_000;
          if (Math.abs(msUntil - target) > WINDOW_TOLERANCE) continue;

          const ch = guild.channels.cache.get(notifChId)
            ?? await guild.channels.fetch(notifChId).catch(() => null);
          if (!ch) continue;

          await ch.send([
            `⏰ Còn **${minutesBefore} phút** nữa có phiên điểm danh!`,
            `\n> **${lich.session_name}** mở lúc <t:${openTs}:t> (<t:${openTs}:R>)`,
          ].join(''));

          sentCache.add(key);
          log.info('REMINDER', guild.id, 'Gửi reminder cho "%s" (%d ph trước, tz=%s)',
            lich.session_name, minutesBefore, tz);
        }
      }
    } catch (err) {
      log.error('REMINDER', guild.id, 'Tick lỗi: %s', err.message);
    }
  }
}

// ── Export ─────────────────────────────────────────────────────────────────

function startReminderScheduler(client) {
  log.info('REMINDER', null, 'Scheduler khởi động (interval %ds)', TICK_MS / 1000);
  setTimeout(() => tick(client).catch(e => log.error('REMINDER', null, 'First tick lỗi: %s', e.message)), 5_000);
  return setInterval(() => tick(client).catch(e => log.error('REMINDER', null, 'Tick lỗi: %s', e.message)), TICK_MS);
}

module.exports = { startReminderScheduler };
