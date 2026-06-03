'use strict';
// utils/scheduler.js
const db  = require('../db.js');
const log = require('./logger.js');
const { msToNextWeekday, msFromOpenToClose, msToCloseFromNow } = require('./timeCalc.js');
const { buildAttendanceButtons, buildSummaryEmbed, buildClosedSessionEmbed } = require('./embeds.js');
const { ketThucPhien, thongBaoHuyHieu, guiCsvDinhKem } = require('./session.js');
const { LichSchema, safeParse } = require('./validate.js');

// Map<guildId, Map<key, timeoutId>>
const schedulerMap = new Map();

const MIN_RESCHEDULE_MS = 5_000;

// ── Tính ms từ "bây giờ" đến "đóng phiên DD" (pre_close_minutes trước giờ mở) ─────
// Trả về null nếu pre_close_minutes = 0 hoặc không có day_of_week/h/minute
// hoặc pre-close đã qua.
function msToPreCloseFromNow(lich) {
  if (!lich?.pre_close_minutes || lich.pre_close_minutes <= 0) return null;
  if (lich.day_of_week == null || lich.hour == null || lich.minute == null) return null;
  // msToNextWeekday trả về offset (ms) từ "bây giờ" đến giờ mở tiếp theo
  const msOpenOffset = msToNextWeekday(lich.day_of_week, lich.hour, lich.minute);
  const msPreCloseOffset = msOpenOffset - lich.pre_close_minutes * 60_000;
  return msPreCloseOffset > 0 ? msPreCloseOffset : null;
}

function _setTimer(guildId, key, tid) {
  if (!schedulerMap.has(guildId)) schedulerMap.set(guildId, new Map());
  const gMap = schedulerMap.get(guildId);
  const old  = gMap.get(key);
  if (old != null) clearTimeout(old);
  gMap.set(key, tid);
}

// ── Lên lịch mở phiên theo tuần ────────────────────────────────────────────
// eslint-disable-next-line require-await
async function scheduleLichCoDinh(client, guildId, lich) {
  const v = safeParse(LichSchema, lich);
  if (!v.ok) {
    log.warn('SCHEDULER', guildId, 'Lịch bị invalid, bỏ qua: %s', v.error);
    return;
  }
  lich = v.data;

  const msOpenRaw = msToNextWeekday(lich.day_of_week, lich.hour, lich.minute);
  const msOpen    = Math.max(msOpenRaw, MIN_RESCHEDULE_MS);
  log.info('SCHEDULER', guildId, '"%s" — mở sau %s phút', lich.session_name, Math.round(msOpen / 60000));

  const tidO = setTimeout(async () => {
    try {
      const g = client.guilds.cache.get(guildId);
      if (!g) {
        await scheduleLichCoDinh(client, guildId, lich);
        return;
      }
      const result = await _moPhien(g, lich);
      if (result.ok && lich.close_day_of_week != null) {
        const msClose = msFromOpenToClose(
          lich.day_of_week, lich.hour, lich.minute,
          lich.close_day_of_week, lich.close_hour, lich.close_minute
        );

        // [BUG-2] Pre-close timer: đóng DD sớm hơn close_time một khoảng pre_close_minutes
        // Chỉ schedule khi close_day_of_week được cấu hình (có thời gian đóng cụ thể).
        if (lich.pre_close_minutes > 0) {
          const msPreClose = Math.max(msClose - lich.pre_close_minutes * 60_000, 5_000);
          log.info('SCHEDULER', guildId, '"%s" pre-close sau %s phút', lich.session_name, Math.round(msPreClose / 60000));
          const tidPC = setTimeout(async () => {
            try {
              const gPC = client.guilds.cache.get(guildId);
              if (!gPC) return;
              const sessPC = await db.getActiveSession(guildId);
              if (!sessPC) return;
              const chPC = await gPC.channels.fetch(lich.channel_id).catch(() => null);
              if (!chPC) return;
              await _dongPhienVaThongKe(gPC, sessPC, chPC, lich, client, false);
              log.info('SCHEDULER', guildId, '"%s" pre-close: đã đóng phiên sớm %d phút', lich.session_name, lich.pre_close_minutes);
            } catch (e) {
              log.error('SCHEDULER', guildId, '"%s" pre-close lỗi: %s', lich.session_name, e.message);
            }
          }, msPreClose);
          _setTimer(guildId, `${lich.id}_preclose`, tidPC);
        }

        log.info('SCHEDULER', guildId, '"%s" đóng sau %s phút', lich.session_name, Math.round(msClose / 60000));
        const tidC = setTimeout(async () => {
          try {
            const g2 = client.guilds.cache.get(guildId);
            if (!g2) return;
            const sess2 = await db.getActiveSession(guildId);
            if (!sess2) return;
            const ch2 = await g2.channels.fetch(lich.channel_id).catch(() => null);
            if (!ch2) return;
            await _dongPhienVaThongKe(g2, sess2, ch2, lich, client, false);
          } catch (e) {
            log.error('SCHEDULER', guildId, '"%s" đóng lỗi: %s', lich.session_name, e.message);
          }
        }, msClose);
        _setTimer(guildId, `${lich.id}_close`, tidC);
      } else if (!result.ok) {
        log.warn('SCHEDULER', guildId, '"%s" bỏ qua mở: %s', lich.session_name, result.reason);
      }
      await scheduleLichCoDinh(client, guildId, lich);
    } catch (e) {
      log.error('SCHEDULER', guildId, 'Lỗi mở phiên: %s', e.message);
      await scheduleLichCoDinh(client, guildId, lich);
    }
  }, msOpen);
  _setTimer(guildId, `${lich.id}_open`, tidO);
}

// ── Mở phiên ──────────────────────────────────────────────────────────────
async function _moPhien(guild, lich) {
  const existing = await db.getActiveSession(guild.id);
  if (existing) {
    log.info('SCHEDULER', guild.id, '%s — bỏ qua mở "%s": đã có phiên đang mở', guild.name, lich.session_name);
    return { ok: false, reason: 'already_open' };
  }

  const ch = await guild.channels.fetch(lich.channel_id).catch(() => null);
  if (!ch) {
    log.warn('SCHEDULER', guild.id, '%s — không tìm thấy kênh %s', guild.name, lich.channel_id);
    return { ok: false, reason: 'channel_not_found' };
  }

  const session = await db.createSession({
    guild_id:            guild.id,
    channel_id:          lich.channel_id,
    session_name:        lich.session_name,
    started_by:          'scheduler',
    allowed_role_id:     lich.allowed_role_id ?? null,
    eligible_member_ids: null,
  });

  if (!session?.id) {
    log.error('SCHEDULER', guild.id, '%s — createSession trả về null cho "%s"', guild.name, lich.session_name);
    return { ok: false, reason: 'db_error' };
  }

  const { buildSessionEmbed } = require('./embeds.js');
  const { embed } = await buildSessionEmbed(guild, session, []);
  const buttons = buildAttendanceButtons(false);
  const pingContent = lich.allowed_role_id ? `<@&${lich.allowed_role_id}>` : null;

  const msg = await ch.send({ content: pingContent, embeds: [embed], components: [buttons] });
  await db.updateSessionMessage(session.id, msg.id);
  log.info('SCHEDULER', guild.id, '%s — đã mở phiên: %s', guild.name, lich.session_name);
  return { ok: true, session };
}

// ── Đóng phiên ───────────────────────────────────────────────────────────
async function runDongLich(client, guildId, lich, silent = false) {
  const g = client.guilds.cache.get(guildId);
  if (!g) return;
  const session = await db.getActiveSession(guildId);
  if (!session) return;
  const ch = await g.channels.fetch(lich.channel_id).catch(() => null);
  if (!ch) return;
  await _dongPhienVaThongKe(g, session, ch, lich, client, silent);
}

async function _dongPhienVaThongKe(guild, session, ch, lich, client, silent = false) {
  const { stopAutoRefresh } = require('./timers.js'); // [C3]
  stopAutoRefresh(session.id);
  try {
    await db.closeSession(session.id);
  } catch (e) {
    log.error('SCHEDULER', guild.id, 'closeSession thất bại %s: %s', session.id, e.message);
  }

  const attended = await db.getAttendances(session.id);
  const statsMap = await ketThucPhien(guild, session, attended);

  try {
    if (session.message_id) {
      const msg = await ch.messages.fetch(session.message_id).catch(() => null);
      if (msg) {
        const closedEmbed  = await buildClosedSessionEmbed(session, attended, guild);
        const disabledBtns = buildAttendanceButtons(true);
        await msg.edit({ embeds: [closedEmbed], components: [disabledBtns] }).catch(() => null);
      }
    }
  } catch (_e) { /* cập nhật message đã xóa — bỏ qua */ }

  if (!silent) {
    const summaryEmbed = buildSummaryEmbed(session, attended, guild, session.phai_role_ids ?? []);
    // Parallel execution: các operations này độc lập với nhau
    await Promise.all([
      ch.send({ embeds: [summaryEmbed] }),
      guiCsvDinhKem(ch, session, attended).catch(_e => { /* gửi CSV thất bại */ }),
      thongBaoHuyHieu(guild, ch, guild.id, session.id, attended, statsMap).catch(_e => { /* huy hiệu thất bại */ }),
    ]);
  }

  log.info('SCHEDULER', guild.id, '%s — đã đóng%s: %s', guild.name, silent ? ' (silent)' : '', session.session_name);
}

// ── Reschedule close sau bot restart ────────────────────────────────────
async function _khoiPhucCloseTimer(client, guild, danhSach) {
  const session = await db.getActiveSession(guild.id);
  if (!session || session.started_by !== 'scheduler' || session.auto_close_at != null) return;

  const lich = danhSach.find(
    l => l.session_name === session.session_name && l.channel_id === session.channel_id
  );
  if (!lich || lich.close_day_of_week == null) return;

  const gMap = schedulerMap.get(guild.id);
  if (gMap?.has(`${lich.id}_close`) || gMap?.has(`${lich.id}_preclose`)) return;

  const msRemaining = msToCloseFromNow(
    lich.day_of_week, lich.hour, lich.minute,
    lich.close_day_of_week, lich.close_hour, lich.close_minute,
    session.created_at
  );

  if (msRemaining === null) {
    log.warn('SCHEDULER', guild.id, '%s — bỏ qua close timer "%s": created_at không hợp lệ', guild.name, session.session_name);
    return;
  }

  if (msRemaining <= 0) {
    log.info('SCHEDULER', guild.id, '%s — phiên "%s" quá giờ đóng, đóng silent', guild.name, session.session_name);
    setImmediate(() => runDongLich(client, guild.id, lich, true));
  } else {
    log.info('SCHEDULER', guild.id, '%s — khôi phục close timer "%s" sau %s phút', guild.name, session.session_name, Math.round(msRemaining / 60000));
    const tidC = setTimeout(() => runDongLich(client, guild.id, lich), msRemaining);
    _setTimer(guild.id, `${lich.id}_close`, tidC);
  }
}

// ── Khởi phục khi bot restart ──────────────────────────────────────────
async function khoiPhucScheduler(client) {
  let totalLich = 0;
  let totalSkipped = 0;
  for (const guild of client.guilds.cache.values()) {
    try {
      const rows = await db.getLichCoDinh(guild.id);
      let guildCount = 0;
      const validRows = [];
      for (const row of rows) {
        const v = safeParse(LichSchema, row);
        if (!v.ok) {
          log.warn('SCHEDULER', guild.id, '%s — lịch #%s bị invalid, bỏ qua: %s', guild.name, row.id ?? '?', v.error);
          totalSkipped++;
          continue;
        }
        validRows.push(v.data);
        await scheduleLichCoDinh(client, guild.id, v.data);
        guildCount++;
        totalLich++;
      }
      if (validRows.length > 0) {
        log.info('SCHEDULER', guild.id, '%s — khôi phục %s/%s lịch', guild.name, guildCount, rows.length);
        await _khoiPhucCloseTimer(client, guild, validRows);
      }
    } catch (e) {
      log.error('SCHEDULER', guild.id, 'Lỗi khôi phục guild: %s', e.message);
    }
  }
  log.info('SCHEDULER', null, 'Tổng: %s lịch (%s bỏ qua) trên %s guild(s)', totalLich, totalSkipped, client.guilds.cache.size);
}

// ── Hủy lịch ────────────────────────────────────────────────────────────
function cancelLichCoDinh(guildId, lichId) {
  const gMap = schedulerMap.get(guildId);
  if (!gMap) return;
  for (const key of [`${lichId}_open`, `${lichId}_close`, `${lichId}_preclose`]) {
    const tid = gMap.get(key);
    if (tid != null) clearTimeout(tid);
    gMap.delete(key);
  }
  if (gMap.size === 0) schedulerMap.delete(guildId);
  log.info('SCHEDULER', guildId, 'Đã hủy lịch %s', lichId);
}

// ── Public API ─────────────────────────────────────────────────────────
async function runLichNgay(client, guildId, lich) {
  const g = client.guilds.cache.get(guildId);
  if (!g) throw new Error('Guild không tìm thấy');
  const v = safeParse(LichSchema, lich);
  if (!v.ok) throw new Error(`Lịch không hợp lệ: ${v.error}`);
  const result = await _moPhien(g, v.data);
  if (!result.ok) return result;
  if (v.data.close_day_of_week != null) {
    const msClose = msFromOpenToClose(
      v.data.day_of_week, v.data.hour, v.data.minute,
      v.data.close_day_of_week, v.data.close_hour, v.data.close_minute
    );

    // [BUG-2] Pre-close timer: đóng DD sớm hơn close_time
    if (v.data.pre_close_minutes > 0) {
      const msPreClose = Math.max(msClose - v.data.pre_close_minutes * 60_000, 5_000);
      log.info('SCHEDULER', guildId, '"%s" pre-close sau %s phút (manual)', v.data.session_name, Math.round(msPreClose / 60000));
      const tidPC = setTimeout(async () => {
        const gPC = client.guilds.cache.get(guildId);
        if (!gPC) return;
        const sessPC = await db.getActiveSession(guildId);
        if (!sessPC) return;
        const chPC = await gPC.channels.fetch(v.data.channel_id).catch(() => null);
        if (!chPC) return;
        await _dongPhienVaThongKe(gPC, sessPC, chPC, v.data, client, false);
      }, msPreClose);
      _setTimer(guildId, `${v.data.id}_preclose`, tidPC);
    }

    log.info('SCHEDULER', guildId, '"%s" đóng sau %s phút (manual)', v.data.session_name, Math.round(msClose / 60000));
    const tidC = setTimeout(async () => {
      const g2 = client.guilds.cache.get(guildId);
      if (!g2) return;
      const sess2 = await db.getActiveSession(guildId);
      if (!sess2) return;
      const ch2 = await g2.channels.fetch(v.data.channel_id).catch(() => null);
      if (!ch2) return;
      await _dongPhienVaThongKe(g2, sess2, ch2, v.data, client, false);
    }, msClose);
    _setTimer(guildId, `${v.data.id}_close`, tidC);
  }
  return result;
}

async function runDongLichNgay(client, guildId, lich) {
  const g = client.guilds.cache.get(guildId);
  if (!g) throw new Error('Guild không tìm thấy');
  const session = await db.getActiveSession(guildId);
  if (!session) throw new Error('Không có phiên đang mở');
  const ch = await g.channels.fetch(lich.channel_id).catch(() => null);
  if (!ch) throw new Error('Không tìm thấy kênh');
  await _dongPhienVaThongKe(g, session, ch, lich, client);
}

module.exports = { scheduleLichCoDinh, cancelLichCoDinh, khoiPhucScheduler, runLichNgay, runDongLichNgay, msToPreCloseFromNow };
