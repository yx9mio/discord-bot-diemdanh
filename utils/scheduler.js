'use strict';
const { EmbedBuilder } = require('discord.js');
const db  = require('../db.js');
const log = require('./logger.js');
const { msToNextWeekday, msFromOpenToClose, msToCloseFromNow } = require('./timeCalc.js');
const { buildAttendanceButtons, buildSummaryEmbed, buildClosedSessionEmbed, FOOTER_DEFAULT } = require('./embeds.js');
const { ketThucPhien, thongBaoHuyHieu, guiCsvDinhKem } = require('./session.js');

// Map<guildId, Map<key, timeoutId>>
const schedulerMap = new Map();

// M-1: floor toối thiểu tránh reschedule tại chỗ nếu msToNextWeekday trả về gần 0
const MIN_RESCHEDULE_MS = 5_000;

function _setTimer(guildId, key, tid) {
  if (!schedulerMap.has(guildId)) schedulerMap.set(guildId, new Map());
  const gMap = schedulerMap.get(guildId);
  const old  = gMap.get(key);
  if (old != null) clearTimeout(old);
  gMap.set(key, tid);
}

// ── Lên lịch mở phiên theo tuần ─────────────────────────────────────────────────────────────────────
async function scheduleLichCoDinh(client, guildId, lich) {
  // M-1: đảm bảo luôn ≥ MIN_RESCHEDULE_MS trước lần mở tiếp theo
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
        log.info('SCHEDULER', guildId, '"%s" đóng sau %s phút', lich.session_name, Math.round(msClose / 60000));
        const tidC = setTimeout(async () => {
          const g2 = client.guilds.cache.get(guildId);
          if (!g2) return;
          const sess2 = await db.getActiveSession(guildId);
          if (!sess2) return;
          const ch2 = await g2.channels.fetch(lich.channel_id).catch(() => null);
          if (!ch2) return;
          await _dongPhienVaThongKe(g2, sess2, ch2, lich, client, false);
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

// ── Mở phiên ────────────────────────────────────────────────────────────────────────────────────
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
  const embed   = await buildSessionEmbed(guild, session, []);
  const buttons = buildAttendanceButtons(false);
  const pingContent = lich.allowed_role_id ? `<@&${lich.allowed_role_id}>` : null;

  const msg = await ch.send({ content: pingContent, embeds: [embed], components: [buttons] });
  await db.updateSessionMessage(session.id, msg.id);
  log.info('SCHEDULER', guild.id, '%s — đã mở phiên: %s', guild.name, lich.session_name);
  return { ok: true, session };
}

// ── Đóng phiên (manual / _khoiPhucCloseTimer) ────────────────────────────────────────────
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
  try {
    await db.closeSession(session.id);
  } catch (e) {
    log.error('SCHEDULER', guild.id, 'closeSession thất bại %s: %s', session.id, e.message);
  }

  const attended = await db.getAttendances(session.id);
  const statsMap = await ketThucPhien(guild, session, attended);

  // M-2: dùng buildClosedSessionEmbed (giống timers.js) thay vì buildSessionEmbed(..., true)
  // để đảm bảo embed đóng có giao diện thống nhất giữa 2 path đóng phiên
  try {
    if (session.message_id) {
      const msg = await ch.messages.fetch(session.message_id).catch(() => null);
      if (msg) {
        const closedEmbed  = await buildClosedSessionEmbed(session, attended, guild);
        const disabledBtns = buildAttendanceButtons(true);
        await msg.edit({ embeds: [closedEmbed], components: [disabledBtns] }).catch(() => null);
      }
    }
  } catch (_) {}

  if (!silent) {
    const thongBao = new EmbedBuilder()
      .setColor(0xff4444)
      .setTitle('🔒 Phiên đã tự động kết thúc')
      .setDescription(
        `✅ Tham gia: ${attended.filter(a => a.status === 'tham_gia').length} | ` +
        `❌ Vắng: ${attended.filter(a => a.status === 'khong_tham_gia').length} | ` +
        `📋 Có phép: ${attended.filter(a => a.status === 'co_phep').length}`
      )
      .setFooter({ text: FOOTER_DEFAULT });
    const summaryEmbed = buildSummaryEmbed(session, attended, guild);
    await ch.send({ embeds: [thongBao, summaryEmbed] });

    try { await guiCsvDinhKem(ch, session, attended); } catch (_) {}
    try { await thongBaoHuyHieu(guild, ch, guild.id, session.id, attended, statsMap); } catch (_) {}
  }

  log.info('SCHEDULER', guild.id, '%s — đã đóng%s: %s', guild.name, silent ? ' (silent)' : '', session.session_name);
}

// ── Reschedule close sau bot restart ────────────────────────────────────────────────────────────────
async function _khoiPhucCloseTimer(client, guild, danhSach) {
  const session = await db.getActiveSession(guild.id);
  // H-1 fix: chỉ recover phiên do scheduler mở và chưa có auto_close_at riêng
  // (auto_close_at != null nghĩa là đã có timer khác xử lý rồi)
  if (!session || session.started_by !== 'scheduler' || session.auto_close_at != null) return;

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

// ── Khởi phục khi bot restart ───────────────────────────────────────────────────────────────────
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
        log.info('SCHEDULER', guild.id, '%s — khôi phục %s lịch', guild.name, danhSach.length);
        await _khoiPhucCloseTimer(client, guild, danhSach);
      }
    } catch (e) {
      log.error('SCHEDULER', guild.id, 'Lỗi khôi phục guild: %s', e.message);
    }
  }
  log.info('SCHEDULER', null, 'Tổng: %s lịch trên %s guild(s)', totalLich, client.guilds.cache.size);
}

// ── Hủy lịch ────────────────────────────────────────────────────────────────────────────────────────
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

// ── Public API ─────────────────────────────────────────────────────────────────────────────────
async function runLichNgay(client, guildId, lich) {
  const g = client.guilds.cache.get(guildId);
  if (!g) throw new Error('Guild không tìm thấy');
  const result = await _moPhien(g, lich);
  if (!result.ok) return result;
  if (lich.close_day_of_week != null) {
    const msClose = msFromOpenToClose(
      lich.day_of_week, lich.hour, lich.minute,
      lich.close_day_of_week, lich.close_hour, lich.close_minute
    );
    log.info('SCHEDULER', guildId, '"%s" đóng sau %s phút (manual)', lich.session_name, Math.round(msClose / 60000));
    const tidC = setTimeout(async () => {
      const g2 = client.guilds.cache.get(guildId);
      if (!g2) return;
      const sess2 = await db.getActiveSession(guildId);
      if (!sess2) return;
      const ch2 = await g2.channels.fetch(lich.channel_id).catch(() => null);
      if (!ch2) return;
      await _dongPhienVaThongKe(g2, sess2, ch2, lich, client, false);
    }, msClose);
    _setTimer(guildId, `${lich.id}_close`, tidC);
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

module.exports = { scheduleLichCoDinh, cancelLichCoDinh, khoiPhucScheduler, runLichNgay, runDongLichNgay };
