'use strict';
// utils/scheduler.js
const db  = require('../db.js');
const log = require('./logger.js');
const metrics = require('./metrics.js'); // [Phase C]
const { msToNextWeekday, msFromOpenToClose, msToCloseFromNow } = require('./timeCalc.js');
const { buildSessionEmbed, buildSessionActionRow, buildSummaryEmbed, buildClosedSessionEmbed } = require('./embeds.js');
const { ketThucPhien, thongBaoHuyHieu, guiCsvDinhKem } = require('./session.js');
const { LichSchema, safeParse } = require('./validate.js');

// Map<guildId, Map<key, timeoutId>>
const schedulerMap = new Map();

const MIN_RESCHEDULE_MS = 5_000;

function _setTimer(guildId, key, tid) {
  if (!schedulerMap.has(guildId)) schedulerMap.set(guildId, new Map());
  schedulerMap.get(guildId).set(key, tid);
}

async function _moPhien(guild, lich) {
  const ch = guild.channels.cache.get(lich.channel_id);
  if (!ch) {
    log.warn('SCHEDULER', guild.id, '%s — channel %s không tồn tại', guild.name, lich.channel_id);
    return { ok: false, reason: 'channel_not_found' };
  }

  const session = await db.createSession({
    guild_id:        guild.id,
    channel_id:      lich.channel_id,
    session_name:    lich.session_name,
    allowed_role_id: lich.allowed_role_id ?? null,
    started_by:      'scheduler',
    phai_role_ids:   lich.phai_role_ids ?? [],
  });

  if (!session?.id) {
    log.error('SCHEDULER', guild.id, '%s — createSession trả về null cho "%s"', guild.name, lich.session_name);
    return { ok: false, reason: 'db_error' };
  }

  // [#13] Fix: dùng buildSessionEmbed + buildSessionActionRow (thay buildAttendanceButtons deprecated)
  const { embed, components: pagComponents } = await buildSessionEmbed(guild, session, []);
  const allComponents = [...buildSessionActionRow(false), ...pagComponents];
  const pingContent = lich.allowed_role_id ? `<@&${lich.allowed_role_id}>` : null;

  const msg = await ch.send({ content: pingContent, embeds: [embed], components: allComponents });
  await db.updateSessionMessage(session.id, msg.id);
  log.info('SCHEDULER', guild.id, '%s — đã mở phiên: %s', guild.name, lich.session_name);

  // [Phase C] Metric: session mở bởi scheduler
  metrics.sessionOpened(guild.id, { scheduled: true });

  return { ok: true, session, message: msg };
}

async function _dongPhienVaThongKe(client, guild, lich, silent = false) {
  const session = await db.getActiveSession(guild.id);
  if (!session) {
    log.warn('SCHEDULER', guild.id, '%s — không có phiên active để đóng (%s)', guild.name, lich?.session_name);
    return;
  }

  const ch = guild.channels.cache.get(session.channel_id);

  metrics.sessionClosed(guild.id, { cancelled: false });
  metrics.sessionMemberCount(guild.id, (await db.getAttendances(session.id)).length);

  try {
    if (ch && session.message_id) {
      const msg = await ch.messages.fetch(session.message_id).catch(() => null);
      if (msg) {
        const attended    = await db.getAttendances(session.id);
        const closedEmbed = await buildClosedSessionEmbed(session, attended, guild);
        // [#13] Fix: dùng buildSessionActionRow(true) thay buildAttendanceButtons deprecated
        await msg.edit({ embeds: [closedEmbed], components: buildSessionActionRow(true) }).catch(() => null);
      }
    }
  } catch (_e) {}

  try {
    await db.closeSession(session.id);
  } catch (e) {
    log.error('SCHEDULER', guild.id, 'closeSession thất bại %s: %s', session.id, e.message);
    // [#14] Fix: kiểm tra session còn active không trước khi tiếp tục thống kê
    const stillActive = await db.getActiveSession(guild.id).catch(() => null);
    if (stillActive?.id === session.id) {
      log.error('SCHEDULER', guild.id, 'Session %s vẫn active sau closeSession lỗi, bỏ qua thống kê', session.id);
      return;
    }
  }

  const attended = await db.getAttendances(session.id);
  const statsMap = await ketThucPhien(guild, session, attended);

  if (!silent && ch) {
    const summaryEmbed = buildSummaryEmbed(session, attended, guild, session.phai_role_ids ?? []);
    await Promise.all([
      ch.send({ embeds: [summaryEmbed] }),
      guiCsvDinhKem(ch, session, attended).catch(_e => {}),
      thongBaoHuyHieu(guild, ch, guild.id, session.id, attended, statsMap).catch(_e => {}),
    ]);
  }

  log.info('SCHEDULER', guild.id, '%s — đã đóng%s: %s', guild.name, silent ? ' (silent)' : '', session.session_name);
}

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

    if (v.data.pre_close_minutes > 0) {
      const msPreClose = Math.max(msClose - v.data.pre_close_minutes * 60_000, 5_000);
      log.info('SCHEDULER', guildId, '"%s" pre-close sau %s phút (manual)', v.data.session_name, Math.round(msPreClose / 60000));
      const tidPC = setTimeout(async () => {
        const gPC = client.guilds.cache.get(guildId);
        if (!gPC) return;
        const sPC = await db.getActiveSession(guildId);
        if (!sPC) return;
        const chPC = gPC.channels.cache.get(sPC.channel_id);
        if (chPC) await chPC.send({ content: `⏰ **${v.data.pre_close_minutes} phút nữa** phiên điểm danh sẽ tự đóng!` });
      }, msPreClose);
      _setTimer(guildId, `manual_preclose`, tidPC);
    }

    log.info('SCHEDULER', guildId, '"%s" tự đóng sau %s phút (manual)', v.data.session_name, Math.round(msClose / 60000));
    const tidC = setTimeout(() => runDongLich(client, guildId, v.data), msClose);
    _setTimer(guildId, `manual_close`, tidC);
  }
  return result;
}

async function runDongLich(client, guildId, lich, silent = false) {
  const g = client.guilds.cache.get(guildId);
  if (!g) {
    log.warn('SCHEDULER', guildId, 'runDongLich: guild không tìm thấy');
    return;
  }
  const gMap = schedulerMap.get(guildId);
  if (gMap) {
    for (const key of [`${lich.id}_close`, `${lich.id}_preclose`, 'manual_close', 'manual_preclose']) {
      const tid = gMap.get(key);
      if (tid != null) clearTimeout(tid);
      gMap.delete(key);
    }
  }
  await _dongPhienVaThongKe(client, g, lich, silent);
}

async function scheduleLichCoDinh(client, guildId, lich) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const gMap = schedulerMap.get(guildId);
  if (gMap?.has(`${lich.id}_open`)) {
    log.warn('SCHEDULER', guildId, 'Lịch %s đã có timer, bỏ qua', lich.id);
    return;
  }

  const msOpen = msToNextWeekday(
    lich.day_of_week, lich.hour, lich.minute
  );

  const schedule = async () => {
    const gS = client.guilds.cache.get(guildId);
    if (!gS) return;

    const lichRows = await db.getLichCoDinh(guildId);
    const currentLich = lichRows.find(l => l.id === lich.id);
    if (!currentLich) {
      log.info('SCHEDULER', guildId, 'Lịch %s không còn tồn tại, dừng schedule', lich.id);
      return;
    }
    const v = safeParse(LichSchema, currentLich);
    if (!v.ok) {
      log.warn('SCHEDULER', guildId, 'Lịch %s invalid khi chạy: %s', lich.id, v.error);
      return;
    }
    const freshLich = v.data;

    const result = await _moPhien(gS, freshLich);
    if (!result.ok) {
      log.warn('SCHEDULER', guildId, 'Mở phiên "%s" thất bại: %s', freshLich.session_name, result.reason);
    }

    if (result.ok && freshLich.close_day_of_week != null) {
      const msClose = msFromOpenToClose(
        freshLich.day_of_week, freshLich.hour, freshLich.minute,
        freshLich.close_day_of_week, freshLich.close_hour, freshLich.close_minute
      );

      if (freshLich.pre_close_minutes > 0) {
        const msPreClose = Math.max(msClose - freshLich.pre_close_minutes * 60_000, 5_000);
        log.info('SCHEDULER', guildId, '"%s" pre-close sau %s phút', freshLich.session_name, Math.round(msPreClose / 60000));
        const tidPC = setTimeout(async () => {
          const gPC = client.guilds.cache.get(guildId);
          if (!gPC) return;
          const sPC = await db.getActiveSession(guildId);
          if (!sPC) return;
          const chPC = gPC.channels.cache.get(sPC.channel_id);
          if (chPC) await chPC.send({ content: `⏰ **${freshLich.pre_close_minutes} phút nữa** phiên điểm danh sẽ tự đóng!` });
        }, msPreClose);
        _setTimer(guildId, `${lich.id}_preclose`, tidPC);
      }

      log.info('SCHEDULER', guildId, '"%s" tự đóng sau %s phút', freshLich.session_name, Math.round(msClose / 60000));
      const tidC = setTimeout(() => runDongLich(client, guildId, freshLich), msClose);
      _setTimer(guildId, `${lich.id}_close`, tidC);
    }

    // Re-schedule cho tuần tiếp
    const msNext = msToNextWeekday(freshLich.day_of_week, freshLich.hour, freshLich.minute);
    if (msNext < MIN_RESCHEDULE_MS) {
      log.warn('SCHEDULER', guildId, 'msNext quá nhỏ (%s ms), bỏ qua re-schedule', msNext);
      return;
    }
    log.info('SCHEDULER', guildId, '"%s" — lên lịch lần tiếp sau %s phút', freshLich.session_name, Math.round(msNext / 60000));
    const tidNext = setTimeout(schedule, msNext);
    _setTimer(guildId, `${lich.id}_open`, tidNext);
  };

  if (msOpen < MIN_RESCHEDULE_MS) {
    log.warn('SCHEDULER', guildId, 'msOpen=%s quá nhỏ cho lịch %s, bỏ qua', msOpen, lich.id);
    return;
  }

  log.info('SCHEDULER', guildId, '%s — lên lịch "%s" sau %s phút', guild.name, lich.session_name, Math.round(msOpen / 60000));
  const tid = setTimeout(schedule, msOpen);
  _setTimer(guildId, `${lich.id}_open`, tid);
}

module.exports = {
  scheduleLichCoDinh,
  khoiPhucScheduler,
  cancelLichCoDinh,
  runLichNgay,
  runDongLich,
};
