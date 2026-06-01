// services/reminderScheduler.js
// Scan lich_co_dinh mỗi phút, gửi reminder vào kênh thông báo trước giờ mở phiên.
//
// Logic:
//   - Chạy setInterval 60s
//   - Mỗi tick: lấy tất cả guild từ cache
//   - Với mỗi guild: lấy reminder_config + lich_co_dinh
//   - Kiểm tra xem có lịch nào sắp mở trong úng dủng minutes_before không
//   - Nếu có và chưa gửi hôm nay → gửi + đánh dấu trong Map
//   - sentCache: Map<`${guildId}:${lichId}:${YYYY-MM-DD}`> → chống gửi 2 lần
'use strict';
const db  = require('../db.js');
const log = require('../utils/logger.js');

// ── Constants ───────────────────────────────────────────────────────────────

const TICK_MS          = 60_000;   // 1 phút
const WINDOW_TOLERANCE = 90_000;   // ±90s quanh đúng thời điểm nhắc

// sentCache: giữ trong memory, tự sạch khi restart
const sentCache = new Set();

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Tính ms đến lần mở tiếp theo của lịch (trong 7 ngày tới).
 * lich_co_dinh: { day_of_week (0=Sun..6=Sat), hour, minute }
 */
function msUntilNextOpen(lich) {
  const now       = new Date();
  const targetDow = lich.day_of_week;   // 0 Sun … 6 Sat
  const todayDow  = now.getDay();

  let daysAhead = targetDow - todayDow;
  if (daysAhead < 0) daysAhead += 7;

  const candidate = new Date(now);
  candidate.setDate(now.getDate() + daysAhead);
  candidate.setHours(lich.hour, lich.minute, 0, 0);

  // Nếu candidate đã qua (hôm nay cùng dow nhưng đã qua giờ) → +7 ngày
  if (candidate.getTime() <= now.getTime()) {
    candidate.setDate(candidate.getDate() + 7);
  }
  return candidate.getTime() - now.getTime();
}

/** Key duy nhất chống gửi 2 lần trong cùng ngày */
function cacheKey(guildId, lichId) {
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return `${guildId}:${lichId}:${dateStr}`;
}

// ── Tick ───────────────────────────────────────────────────────────────────

async function tick(client) {
  for (const guild of client.guilds.cache.values()) {
    try {
      const cfg = await db.getConfig(guild.id);
      const rcfg = cfg?.reminder_config;

      // Bỏ qua nếu reminder tắt hoặc chưa cài
      if (!rcfg?.enabled) continue;

      const minutesBefore = rcfg.minutes_before ?? 15;
      const message       = rcfg.message ?? '⏰ Sắp có phiên điểm danh!';
      const notifChId     = cfg.notification_channel_id ?? cfg.channel_id;
      if (!notifChId) continue;

      const lichList = await db.getLichCoDinh(guild.id);
      if (!lichList.length) continue;

      for (const lich of lichList) {
        const key = cacheKey(guild.id, lich.id);
        if (sentCache.has(key)) continue;

        const msUntil = msUntilNextOpen(lich);
        const target  = minutesBefore * 60_000;  // ms cần nhắc

        // Kiểm tra: msUntil phải gần target ± tolerance
        const diff = Math.abs(msUntil - target);
        if (diff > WINDOW_TOLERANCE) continue;

        // Gửi reminder
        const ch = guild.channels.cache.get(notifChId)
          ?? await guild.channels.fetch(notifChId).catch(() => null);
        if (!ch) continue;

        const openTs = Math.floor((Date.now() + msUntil) / 1000);
        const text   = [
          message,
          `\n> **${lich.session_name}** mở lúc <t:${openTs}:t> (<t:${openTs}:R>)`,
        ].join('');

        await ch.send(text);
        sentCache.add(key);
        log.info('REMINDER', guild.id, 'Gửi reminder cho lịch “%s” (%d ph trước)',
          lich.session_name, minutesBefore);
      }
    } catch (err) {
      log.error('REMINDER', guild.id, 'Tick lỗi: %s', err.message);
    }
  }
}

// ── Export ───────────────────────────────────────────────────────────────────

/**
 * Khởi động reminder scheduler.
 * Gọi trong ReadyListener sau khi client sẵn sàng.
 *
 * @param {import('discord.js').Client} client
 * @returns {NodeJS.Timeout} interval handle (có thể clearInterval khi test)
 */
function startReminderScheduler(client) {
  log.info('REMINDER', null, 'Scheduler khởi động (interval %ds)', TICK_MS / 1000);
  // Chạy lần đầu ngay sau 5s (tránh block ready)
  setTimeout(() => tick(client).catch(e => log.error('REMINDER', null, 'First tick lỗi: %s', e.message)), 5_000);
  return setInterval(() => tick(client).catch(e => log.error('REMINDER', null, 'Interval tick lỗi: %s', e.message)), TICK_MS);
}

module.exports = { startReminderScheduler };
