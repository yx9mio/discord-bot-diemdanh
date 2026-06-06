'use strict';
// utils/scheduler.js
// [B-3] Migrate từ db.js → services layer
const sessionService   = require('../services/sessionService.js');
const scheduledService = require('../services/scheduledService.js');
const configService    = require('../services/configService.js');
const { msToNextWeekday, msToCloseFromNow } = require('./timeUtils.js');
const log = require('./logger.js');

const MIN_RESCHEDULE_MS = 5_000;
const _timers = new Map(); // guildId → { open?: Timeout, close?: Timeout, preclose?: Timeout }

function _setTimer(guildId, key, fn, ms) {
  const existing = _timers.get(guildId) ?? {};
  if (existing[key]) clearTimeout(existing[key]);
  existing[key] = setTimeout(fn, ms);
  _timers.set(guildId, existing);
}

function _clearTimer(guildId, key) {
  const existing = _timers.get(guildId);
  if (existing?.[key]) { clearTimeout(existing[key]); delete existing[key]; }
}

function clearGuildTimers(guildId) {
  const existing = _timers.get(guildId);
  if (!existing) return;
  for (const k of Object.keys(existing)) clearTimeout(existing[k]);
  _timers.delete(guildId);
}

// ─── Restore close timer sau khi restart ─────────────────────────────────────
async function _khoiPhucCloseTimer(client, guild, session, lich) {
  const msRemaining = msToCloseFromNow(
    lich.day_of_week, lich.hour, lich.minute,
    lich.close_day_of_week, lich.close_hour, lich.close_minute,
    session.created_at  // [FIX-BUG4] truyền sessionCreatedAt để tính đúng thời gian còn lại
  );
  if (msRemaining == null || msRemaining <= 0) {
    log.info('SCHEDULER', guild.id, 'Close timer hết hạn — đóng ngay');
    const ch = await _getAnnounceCh(client, guild);
    return _dongPhienVaThongKe(guild, session, ch, lich, client);
  }
  log.info('SCHEDULER', guild.id, 'Restore close timer: %dms', msRemaining);
  const ch = await _getAnnounceCh(client, guild);
  _setTimer(guild.id, 'close', () => _dongPhienVaThongKe(guild, session, ch, lich, client), msRemaining);
}

// ─── Đóng phiên + thống kê ───────────────────────────────────────────────────
async function _dongPhienVaThongKe(guild, session, ch, lich, client, silent = false) {
  const { stopAutoRefresh } = require('./timers.js');
  stopAutoRefresh(session.id);
  // [FIX-BUG7] closeSession atomic: nếu đã đóng rồi (double-close race) thì abort
  let closedSession;
  try {
    closedSession = await sessionService.closeSession(session.id);
  } catch (e) {
    log.warn('SCHEDULER', guild.id, 'closeSession %s thất bại (có thể đã đóng): %s', session.id, e.message);
    return; // abort — phiên đã được đóng bởi timer khác
  }
  if (!closedSession) {
    log.warn('SCHEDULER', guild.id, 'closeSession %s trả về null — bỏ qua double close', session.id);
    return;
  }
  _clearTimer(guild.id, 'close');
  _clearTimer(guild.id, 'preclose');
  if (!silent && ch) {
    try { await ch.send({ content: '🔒 Phiên điểm danh đã kết thúc.' }); } catch {}
  }
}

// ─── Mở phiên ────────────────────────────────────────────────────────────────
async function _moPhien(guild, lich) {
  // [FIX-BUG8] Kiểm tra skip_until trước khi mở phiên
  if (lich.skip_until) {
    const skipUntil = new Date(lich.skip_until);
    if (!isNaN(skipUntil.getTime()) && skipUntil > new Date()) {
      log.info('SCHEDULER', guild.id, '"%s" — bỏ qua: skip_until=%s', lich.session_name, lich.skip_until);
      return { ok: false, reason: 'skipped' };
    }
  }
  const existing = await sessionService.getActiveSession(guild.id);
  if (existing) {
    log.warn('SCHEDULER', guild.id, 'Đã có phiên đang mở (%s), bỏ qua', existing.id);
    return { ok: false, reason: 'already_open' };
  }
  const sess = await sessionService.createSession({
    guild_id:     guild.id,
    schedule_id:  lich.id,
    session_name: lich.session_name,
    phai_role_ids: lich.phai_role_ids ?? [],
  });
  log.info('SCHEDULER', guild.id, 'Mở phiên "%s" id=%s', lich.session_name, sess.id);
  return { ok: true, session: sess };
}

async function _getAnnounceCh(client, guild) {
  try {
    const cfg = await configService.getGuildConfig(guild.id);
    if (!cfg?.announce_channel_id) return null;
    return client.channels.fetch(cfg.announce_channel_id).catch(() => null);
  } catch { return null; }
}

// ─── Schedule 1 lịch cố định ─────────────────────────────────────────────────
async function scheduleLichCoDinh(client, guildId, lichRaw) {
  const { safeParseLich } = require('./validation.js');
  const v = safeParseLich(lichRaw);
  if (!v.ok) {
    log.warn('SCHEDULER', guildId, 'Lịch không hợp lệ (id=%s): %s', lichRaw?.id, v.error);
    return;
  }
  let lich = v.data;

  // [FIX-BUG2] Normalize open_hour/open_minute → hour/minute (DB dùng open_hour, scheduler dùng hour)
  if (lich.hour == null && lich.open_hour != null) lich = { ...lich, hour: lich.open_hour, minute: lich.open_minute };

  // [FIX-BUG1] one_time: tính ms đến scheduled_date thay vì msToNextWeekday
  let msOpenRaw;
  if (lich.type === 'one_time' && lich.scheduled_date) {
    const [yyyy, mm, dd] = lich.scheduled_date.split('-').map(Number);
    const target = new Date(yyyy, mm - 1, dd, lich.hour ?? 0, lich.minute ?? 0, 0, 0);
    msOpenRaw = target.getTime() - Date.now();
    if (msOpenRaw <= 0) {
      log.info('SCHEDULER', guildId, '"%s" one-time đã qua ngày (%s), bỏ qua', lich.session_name, lich.scheduled_date);
      return; // lịch một lần đã quá hạn
    }
  } else {
    msOpenRaw = msToNextWeekday(lich.day_of_week, lich.hour, lich.minute);
  }
  const msOpen    = Math.max(msOpenRaw, MIN_RESCHEDULE_MS);

  log.info('SCHEDULER', guildId, 'Đặt lịch "%s" mở sau %dms', lich.session_name, msOpen);

  _setTimer(guildId, `open_${lich.id}`, async () => {
    try {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return;
      const result = await _moPhien(guild, lich);
      if (!result.ok) {
        // [FIX-BUG1] one_time không reschedule — chỉ recurring_weekly mới lặp lại
        if (lich.type !== 'one_time') await scheduleLichCoDinh(client, guildId, lich);
        return;
      }
      const { session } = result;
      const ch = await _getAnnounceCh(client, guild);
      if (ch) {
        try { await ch.send({ content: `📋 Phiên **${lich.session_name}** đã mở!` }); } catch {}
      }
      // Schedule close timer
      if (lich.close_hour != null) {
        const msClose = msToCloseFromNow(
          lich.day_of_week, lich.hour, lich.minute,
          lich.close_day_of_week, lich.close_hour, lich.close_minute,
          session.created_at
        );
        if (msClose != null && msClose > 0) {
          // Pre-close reminder
          if (lich.pre_close_minutes > 0) {
            const msPreClose = msClose - lich.pre_close_minutes * 60_000;
            if (msPreClose > MIN_RESCHEDULE_MS) {
              _setTimer(guildId, 'preclose', async () => {
                const sess2 = await sessionService.getActiveSession(guildId).catch(() => null);
                if (!sess2) return;
                if (ch) try { await ch.send({ content: `⏰ Phiên sẽ đóng sau **${lich.pre_close_minutes} phút**!` }); } catch {}
              }, msPreClose);
            }
          }
          _setTimer(guildId, 'close', async () => {
            const guild2 = client.guilds.cache.get(guildId);
            if (!guild2) return;
            const sess2 = await sessionService.getActiveSession(guildId).catch(() => null);
            if (!sess2) return;
            await _dongPhienVaThongKe(guild2, sess2, ch, lich, client);
          }, msClose);
        }
      }
      // [FIX-BUG1] one_time không reschedule — chỉ recurring_weekly mới lặp lại
      if (lich.type !== 'one_time') await scheduleLichCoDinh(client, guildId, lich);
    } catch (e) {
      log.error('SCHEDULER', guildId, 'Lỗi mở phiên: %s', e.message);
      if (lich.type !== 'one_time') await scheduleLichCoDinh(client, guildId, lich);
    }
  }, msOpen);
}

// ─── Init tất cả lịch cho 1 guild ────────────────────────────────────────────
async function initGuildScheduler(client, guildId) {
  const lichs = await scheduledService.getActiveSchedules(guildId);
  clearGuildTimers(guildId);
  for (const lich of lichs) {
    await scheduleLichCoDinh(client, guildId, lich);
  }
  // Restore close timer nếu có phiên đang mở
  const session = await sessionService.getActiveSession(guildId).catch(() => null);
  if (session?.schedule_id) {
    const lich = lichs.find(l => l.id === session.schedule_id);
    if (lich) {
      const guild = client.guilds.cache.get(guildId);
      if (guild) await _khoiPhucCloseTimer(client, guild, session, lich);
    }
  }
  log.info('SCHEDULER', guildId, 'Khởi tạo %d lịch', lichs.length);
}

// ─── Reminder scheduler (cron-style, chạy mỗi phút) ─────────────────────────
let _reminderInterval = null;
async function startReminderScheduler(client) {
  if (_reminderInterval) return;
  log.info('Reminder scheduler started');
  _reminderInterval = setInterval(async () => {
    try {
      const now = new Date();
      const allReminders = await scheduledService.getDueReminders(now);
      for (const r of allReminders) {
        try {
          const guild = client.guilds.cache.get(r.guild_id);
          if (!guild) continue;
          const ch = await _getAnnounceCh(client, guild);
          if (ch) await ch.send({ content: r.message });
          await scheduledService.markReminderSent(r.id);
        } catch (e) {
          log.error('REMINDER', r.guild_id, 'Gửi reminder %s thất bại: %s', r.id, e.message);
        }
      }
    } catch (e) {
      log.error('REMINDER', 'global', 'Reminder loop lỗi: %s', e.message);
    }
  }, 60_000);
}

module.exports = {
  initGuildScheduler,
  scheduleLichCoDinh,
  clearGuildTimers,
  startReminderScheduler,
};
