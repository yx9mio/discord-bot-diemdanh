// utils/scheduler.js — Lịch cố định tự động mở/đóng phiên
// Fix #1: clear timer cũ trước khi set mới (tránh zombie timer)
// Fix #2: _rescheduleClose dùng msToCloseFromNow (không tính lại từ đầu chu kỳ)
// Fix #3: _dongPhienVaThongKe gọi thongBaoHuyHieu + guiCsvDinhKem
// Fix #4: loại bỏ ephemeral deprecated warning khỏi handler setup
// Fix #5: ketThucPhien(guild, session, attended) — sửa TypeError
// Fix #6: buildSummaryEmbed(session, attended, guild) — sửa thứ tự params
// Fix #7: guard createSession null trong _moPhien → reschedule mở tuần sau thay vì crash
// Fix #8: _moPhien trả về { ok, reason } thay vì null thuần — handler hiển thị đúng message
// Phase H: ping role điểm danh khi mở phiên tự động
'use strict';
const { EmbedBuilder, MessageFlags } = require('discord.js');
const db  = require('../db.js');
const log = require('./logger.js');
const { msToNextWeekday, msFromOpenToClose, msToCloseFromNow } = require('./timeCalc.js');
const { buildSessionEmbed, buildAttendanceButtons, buildSummaryEmbed, ICONS } = require('./embeds.js');
const { ketThucPhien, thongBaoHuyHieu, voHieuHoaNutDiemDanh } = require('./session.js');

// ── Map<guildId, Map<key, timeoutId>> ────────────────────────────────────────────────
const schedulerMap = new Map();

// FIX #1: clear timer cũ trước khi ghi mới → không để zombie timer
function _setTimer(guildId, key, tid) {
  if (!schedulerMap.has(guildId)) schedulerMap.set(guildId, new Map());
  const gMap = schedulerMap.get(guildId);
  const old  = gMap.get(key);
  if (old != null) clearTimeout(old);
  gMap.set(key, tid);
}

// ── GIAI ĐOẠN 1: Lên lịch mở phiên theo tuần ───────────────────────────────────
async function scheduleLichCoDinh(client, guildId, lich) {
  const msOpen = msToNextWeekday(lich.day_of_week, lich.hour, lich.minute);
  log.info('SCHEDULER', guildId, '"Lịch" %s — MỬ sau %s phút', lich.session_name, Math.round(msOpen / 60000));

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
        log.info('SCHEDULER', guildId, '"%s" ĐÓNG sau %s phút', lich.session_name, Math.round(msClose / 60000));
        const tidC = setTimeout(() => runDongLich(client, guildId, lich), msClose);
        _setTimer(guildId, `${lich.id}_close`, tidC);
      } else if (!result.ok) {
        log.warn('SCHEDULER', guildId, '"%s" bỏ qua mở tự động: %s', lich.session_name, result.reason);
      }
      await scheduleLichCoDinh(client, guildId, lich);
    } catch (e) {
      log.error('SCHEDULER', guildId, 'Lỗi mở phiên: %s', e.message);
      await scheduleLichCoDinh(client, guildId, lich);
    }
  }, msOpen);
  _setTimer(guildId, `${lich.id}_open`, tidO);
}

// ── GIAI ĐOẠN 2: Mở phiên ────────────────────────────────────────────────────────
// FIX #8: trả về { ok: true, session } hoặc { ok: false, reason: string }
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
    guild_id:     guild.id,
    channel_id:   lich.channel_id,
    session_name: lich.session_name,
    started_by:   'scheduler',
    allowed_role_id: lich.allowed_role_id ?? null,
    eligible_member_ids: null,
  });

  // FIX #7: guard createSession null → không crash, reschedule mở tuần sau từ caller
  if (!session?.id) {
    log.error('SCHEDULER', guild.id, '%s — createSession trả về null/undefined cho "%s"', guild.name, lich.session_name);
    return { ok: false, reason: 'db_error' };
  }

  const embed   = await buildSessionEmbed(guild, session, []);
  const buttons = buildAttendanceButtons(false);

  let pingContent = null;
  if (lich.allowed_role_id) {
    pingContent = `<@&${lich.allowed_role_id}>`;
  }

  const msg = await ch.send({
    content: pingContent,
    embeds:  [embed],
    components: [buttons],
  });

  await db.updateSessionMessage(session.id, msg.id);
  log.info('SCHEDULER', guild.id, '%s — ĐÃ MỬ phiên: %s (ping %s)', guild.name, lich.session_name, pingContent ?? 'không có');
  return { ok: true, session };
}

// ── GIAI ĐOẠN 3: Đóng phiên + thống kê ──────────────────────────────────────────
async function runDongLich(client, guildId, lich, silent = false) {
  const g = client.guilds.cache.get(guildId);
  if (!g) return;
  const session = await db.getActiveSession(guildId);
  if (!session) return;
  const ch = await g.channels.fetch(lich.channel_id).catch(() => null);
  if (!ch) return;
  await _dongPhienVaThongKe(g, session, ch, lich, client, silent);
  await scheduleLichCoDinh(client, guildId, lich);
}

async function _dongPhienVaThongKe(guild, session, ch, lich, client, silent = false) {
  const attended = await db.getAttendances(session.id);
  const statsMap = await ketThucPhien(guild, session, attended);

  // Vô hiệu hóa nút điểm danh (luôn làm, kể cả silent)
  try {
    if (session.message_id) {
      const msg = await ch.messages.fetch(session.message_id).catch(() => null);
      if (msg) {
        const closedEmbed = await buildSessionEmbed(guild, session, attended, true);
        const disabledBtns = buildAttendanceButtons(true);
        await msg.edit({ embeds: [closedEmbed], components: [disabledBtns] }).catch(() => null);
      }
    }
  } catch (_) {}

  // Chỉ gửi thông báo/thống kê khi KHÔNG phải silent close (restart)
  if (!silent) {
    const closedEmbed  = new EmbedBuilder()
      .setColor(0xff4444)
      .setTitle('🔒 Phiên đã kết thúc tự động')
      .setDescription(
        `✅ Tham gia: ${attended.filter(a => a.status === 'tham_gia').length} | ` +
        `❌ Vắng: ${attended.filter(a => a.status === 'khong_tham_gia').length} | ` +
        `📋 Có phép: ${attended.filter(a => a.status === 'co_phep').length}`
      );

    // FIX #6: đúng thứ tự (session, attended, guild) theo signature của embeds.js
    const summaryEmbed = await buildSummaryEmbed(session, attended, guild);
    await ch.send({ embeds: [closedEmbed, summaryEmbed] });

    // CSV đính kèm
    try {
      const { guiCsvDinhKem } = require('./session.js');
      await guiCsvDinhKem(ch, session, attended);
    } catch (_) {}

    // Thông báo hủy hiệu
    try {
      await thongBaoHuyHieu(client, guild.id, session, attended);
    } catch (_) {}
  }

  log.info('SCHEDULER', guild.id, '%s — ĐÃ ĐÓNG%s & thống kê: %s', guild.name, silent ? ' (silent)' : '', session.session_name);
}

// ── FIX #2: reschedule close dùng ms còn lại từ hiện tại ───────────────────────
async function _rescheduleClose(client, guildId, lich, session) {
  let msClose;
  if (session?.created_at && lich.close_day_of_week != null) {
    msClose = msToCloseFromNow(
      lich.day_of_week, lich.hour, lich.minute,
      lich.close_day_of_week, lich.close_hour, lich.close_minute,
      session.created_at
    );
  }
  if (!msClose || msClose === null || msClose <= 0) {
    msClose = msFromOpenToClose(
      lich.day_of_week, lich.hour, lich.minute,
      lich.close_day_of_week, lich.close_hour, lich.close_minute
    );
  }
  const tidC = setTimeout(() => runDongLich(client, guildId, lich), msClose);
  _setTimer(guildId, `${lich.id}_close`, tidC);
}

// ── Hủy lịch ────────────────────────────────────────────────────────────────────
function cancelLichCoDinh(guildId, lichId) {
  const gMap = schedulerMap.get(guildId);
  if (!gMap) return;
  for (const key of [`${lichId}_open`, `${lichId}_close`]) {
    const tid = gMap.get(key);
    if (tid != null) clearTimeout(tid);
    gMap.delete(key);
  }
  if (gMap.size === 0) schedulerMap.delete(guildId);
  log.info('SCHEDULER', guildId, 'Đã hủy lịch %s', lichId);
}

async function _khoiPhucCloseTimer(client, guild, danhSach) {
  const session = await db.getActiveSession(guild.id);
  if (!session || session.started_by !== 'scheduler' || session.auto_close_at) return;

  const lich = danhSach.find(
    l => l.session_name === session.session_name && l.channel_id === session.channel_id
  );
  if (!lich || lich.close_day_of_week == null) return;

  const gMap = schedulerMap.get(guild.id);
  if (gMap?.has(`${lich.id}_close`)) return;

  const msRemaining = msToCloseFromNow(
    lich.day_of_week, lich.hour, lich.minute,
    lich.close_day_of_week, lich.close_hour, lich.close_minute,
    session.created_at
  );

  // Guard: nếu msRemaining = null (created_at null/invalid) → KHÔNG đóng, chỉ bỏ qua
  if (msRemaining === null) {
    log.warn('SCHEDULER', guild.id, '%s — bỏ qua close timer "%s": session.created_at không hợp lệ (%s)', guild.name, session.session_name, session.created_at);
    return;
  }

  if (msRemaining <= 0) {
    // Phiên đã qua giờ đóng trong khi bot offline → đóng SILENT (không spam channel)
    log.info('SCHEDULER', guild.id, '%s — phiên "%s" đã qua giờ đóng khi offline, đóng silent', guild.name, session.session_name);
    setImmediate(() => runDongLich(client, guild.id, lich, true));
  } else {
    log.info('SCHEDULER', guild.id, '%s — khôi phục close timer "%s" sau %s phút', guild.name, session.session_name, Math.round(msRemaining / 60000));
    const tidC = setTimeout(() => runDongLich(client, guild.id, lich), msRemaining);
    _setTimer(guild.id, `${lich.id}_close`, tidC);
  }
}

// ── Khôi phục khi bot restart ───────────────────────────────────────────────────
async function khoiPhucScheduler(client) {
  let totalLich = 0;
  for (const guild of client.guilds.cache.values()) {
    try {
      const danhSach = await db.getLichCoDinh(guild.id);
      for (const lich of danhSach) {
        await scheduleLichCoDinh(client, guild.id, lich);
      }
      if (danhSach.length > 0) {
        totalLich += danhSach.length;
        log.info('SCHEDULER', guild.id, '%s — khôi phục %s lịch cố định', guild.name, danhSach.length);
        await _khoiPhucCloseTimer(client, guild, danhSach);
      }
    } catch (e) {
      log.error('SCHEDULER', guild.id, 'Lỗi khôi phục guild: %s', e.message);
    }
  }
  log.info('SCHEDULER', null, 'Tổng: khôi phục %s lịch trên %s guild(s)', totalLich, client.guilds.cache.size);
}

// ── PUBLIC API ──────────────────────────────────────────────────────────────────
// FIX #8: runLichNgay giờ trả về { ok, reason } từ _moPhien — caller (lichHandler) đọc để hiển thị đúng
async function runLichNgay(client, guildId, lich) {
  const g = client.guilds.cache.get(guildId);
  if (!g) throw new Error('Guild không tìm thấy');
  const result = await _moPhien(g, lich);
  if (!result.ok) return result; // trả về { ok: false, reason } cho handler
  if (lich.close_day_of_week != null) {
    const msClose = msFromOpenToClose(
      lich.day_of_week, lich.hour, lich.minute,
      lich.close_day_of_week, lich.close_hour, lich.close_minute
    );
    log.info('SCHEDULER', guildId, '%s — "%s" ĐÓNG sau %s phút (manual open)', g.name, lich.session_name, Math.round(msClose / 60000));
    const tidC = setTimeout(() => runDongLich(client, guildId, lich), msClose);
    _setTimer(guildId, `${lich.id}_close`, tidC);
  }
  return result; // { ok: true, session }
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

module.exports = {
  scheduleLichCoDinh,
  cancelLichCoDinh,
  khoiPhucScheduler,
  runLichNgay,
  runDongLichNgay,
};
