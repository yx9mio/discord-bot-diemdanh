// services/reminderScheduler.js
// Scan lich_co_dinh mỗi phút, gửi reminder vào kênh thông báo trước giờ mở phiên.
// Hỗ trợ timezone per-guild (lưu trong guild_config.timezone, IANA string).
'use strict';
const db  = require('../db.js');
const log = require('../utils/logger.js');

// ── Constants ──────────────────────────────────────────────────────────

const TICK_MS          = 60_000;  // 1 phút
const WINDOW_TOLERANCE = 90_000;  // ±90s quanh đúng thời điểm nhắc
const DEFAULT_TZ       = 'Asia/Ho_Chi_Minh';

const sentCache = new Set();

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Tính ms đến lần mở tiếp theo của lịch, tính theo timezone của guild.
 * lich: { day_of_week (0=Sun…6=Sat), hour, minute }
 * timezone: IANA string, e.g. 'Asia/Ho_Chi_Minh'
 */
function msUntilNextOpen(lich, timezone) {
  const tz  = timezone || DEFAULT_TZ;
  const now = new Date();

  // Lấy ngày/giờ hiện tại theo timezone guild
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const get = (type) => parts.find(p => p.type === type)?.value;

  const todayDow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(get('weekday'));
  const year     = parseInt(get('year'),  10);
  const month    = parseInt(get('month'), 10) - 1;  // 0-indexed
  const day      = parseInt(get('day'),   10);

  // Tìm candidate: ngày tiếp theo có dow khớp trong timezone guild
  let daysAhead = lich.day_of_week - todayDow;
  if (daysAhead < 0) daysAhead += 7;

  // Candidate trong local-guild time
  // Dùng trick: tạo Date từ UTC timestamp tương đương local time
  // bằng cách dùng Intl offset
  const localMidnight = new Date(`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}T00:00:00`);
  // Điều chỉnh để local midnight trong guild tz
  const tzOffset = getTzOffsetMs(tz, now);
  // Candidate UTC
  const candidateUtc = new Date(
    localMidnight.getTime()
    + daysAhead * 86_400_000
    + lich.hour   * 3_600_000
    + lich.minute * 60_000
    - tzOffset
  );

  // Nếu đã qua (cùng dow nhưng đã qua giờ) → +7 ngày
  if (candidateUtc.getTime() <= now.getTime()) {
    candidateUtc.setDate(candidateUtc.getDate() + 7);
  }

  return candidateUtc.getTime() - now.getTime();
}

/**
 * Lấy UTC offset (ms) của timezone tại thời điểm `date`.
 * VD: Asia/Ho_Chi_Minh = +7h → return +25_200_000
 */
function getTzOffsetMs(timezone, date) {
  const utcStr   = new Date(date).toLocaleString('en-US', { timeZone: 'UTC' });
  const localStr = new Date(date).toLocaleString('en-US', { timeZone: timezone });
  return new Date(localStr) - new Date(utcStr);
}

/** Key chống gửi 2 lần trong cùng ngày (theo guild tz) */
function cacheKey(guildId, lichId, timezone) {
  const tz = timezone || DEFAULT_TZ;
  const d  = new Date();
  const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d); // YYYY-MM-DD
  return `${guildId}:${lichId}:${dateStr}`;
}

// ── Tick ───────────────────────────────────────────────────────────────────

async function tick(client) {
  for (const guild of client.guilds.cache.values()) {
    try {
      const cfg  = await db.getConfig(guild.id);
      const rcfg = cfg?.reminder_config;
      if (!rcfg?.enabled) continue;

      const tz            = cfg.timezone || DEFAULT_TZ;
      const minutesBefore = rcfg.minutes_before ?? 15;
      const message       = rcfg.message ?? '⏰ Sắp có phiên điểm danh!';
      const notifChId     = cfg.notification_channel_id ?? cfg.channel_id;
      if (!notifChId) continue;

      const lichList = await db.getLichCoDinh(guild.id);
      if (!lichList.length) continue;

      for (const lich of lichList) {
        const key = cacheKey(guild.id, lich.id, tz);
        if (sentCache.has(key)) continue;

        const msUntil = msUntilNextOpen(lich, tz);
        const target  = minutesBefore * 60_000;
        if (Math.abs(msUntil - target) > WINDOW_TOLERANCE) continue;

        const ch = guild.channels.cache.get(notifChId)
          ?? await guild.channels.fetch(notifChId).catch(() => null);
        if (!ch) continue;

        const openTs = Math.floor((Date.now() + msUntil) / 1000);
        await ch.send([
          message,
          `\n> **${lich.session_name}** mở lúc <t:${openTs}:t> (<t:${openTs}:R>)`,
        ].join(''));

        sentCache.add(key);
        log.info('REMINDER', guild.id, 'Gửi reminder cho “%s” (%d ph trước, tz=%s)',
          lich.session_name, minutesBefore, tz);
      }
    } catch (err) {
      log.error('REMINDER', guild.id, 'Tick lỗi: %s', err.message);
    }
  }
}

// ── Export ───────────────────────────────────────────────────────────────────

function startReminderScheduler(client) {
  log.info('REMINDER', null, 'Scheduler khởi động (interval %ds)', TICK_MS / 1000);
  setTimeout(() => tick(client).catch(e => log.error('REMINDER', null, 'First tick lỗi: %s', e.message)), 5_000);
  return setInterval(() => tick(client).catch(e => log.error('REMINDER', null, 'Tick lỗi: %s', e.message)), TICK_MS);
}

module.exports = { startReminderScheduler };
