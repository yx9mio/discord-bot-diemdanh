// utils/scheduler.js — Lịch cố định 2 giai đoạn: mở phiên + đóng & thống kê phái
const db  = require('../db.js');
const log = require('./logger.js');
const { buildSessionEmbed, buildAttendanceButtons, FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('./embeds.js');
const { ketThucPhien, voHieuHoaNutDiemDanh } = require('./session.js');
const { EmbedBuilder } = require('discord.js');

// Map<guildId, Map<lichId_open | lichId_close, timeoutId>>
const schedulerMap = new Map();

// ── Tính ms đến lần chạy tiếp theo (giờ VN) ──────────────────────────────────
function msToNextOccurrence(dayOfWeek, hour, minute) {
  const VN_OFFSET = 7 * 60 * 60 * 1000;
  const nowUtc    = Date.now();
  const nowVn     = new Date(nowUtc + VN_OFFSET);
  const curDay    = nowVn.getUTCDay();
  const curH      = nowVn.getUTCHours();
  const curM      = nowVn.getUTCMinutes();
  const curS      = nowVn.getUTCSeconds();
  const curMs     = nowVn.getUTCMilliseconds();

  let daysUntil = (dayOfWeek - curDay + 7) % 7;
  if (daysUntil === 0) {
    const secPassed = curH * 3600 + curM * 60 + curS;
    const secTarget = hour * 3600 + minute * 60;
    if (secPassed >= secTarget) daysUntil = 7;
  }

  const nowVnMidnight = nowUtc + VN_OFFSET - (curH * 3600 + curM * 60 + curS) * 1000 - curMs;
  const targetVnMs    = nowVnMidnight + daysUntil * 86400000 + hour * 3600000 + minute * 60000;
  return targetVnMs - VN_OFFSET - nowUtc;
}

// ── BUG #1/#8 FIX: Tính ms từ thời điểm open đến close trong vòng tuần ───────
function msFromOpenToClose(openDay, openHour, openMinute, closeDay, closeHour, closeMinute) {
  const openMinTotal  = openDay  * 24 * 60 + openHour  * 60 + openMinute;
  const closeMinTotal = closeDay * 24 * 60 + closeHour * 60 + closeMinute;

  let deltaMin = (closeMinTotal - openMinTotal + 7 * 24 * 60) % (7 * 24 * 60);
  if (deltaMin === 0) deltaMin = 7 * 24 * 60;

  return deltaMin * 60 * 1000;
}

// ── Tính ms từ NOW đến thời điểm close của phiên đang mở (khi restart) ───────
function msToCloseFromNow(openDay, openHour, openMinute, closeDay, closeHour, closeMinute, sessionCreatedAt) {
  const deltaMs    = msFromOpenToClose(openDay, openHour, openMinute, closeDay, closeHour, closeMinute);
  const openTime   = new Date(sessionCreatedAt).getTime();
  const closeTime  = openTime + deltaMs;
  return closeTime - Date.now();
}

// ── Lên lịch open ─────────────────────────────────────────────────────────────
async function scheduleLichCoDinh(client, guildId, lich) {
  const ms = msToNextOccurrence(lich.day_of_week, lich.hour, lich.minute);
  log.info('SCHEDULER', guildId, '"%s" MỞ sau %s phút', lich.session_name, Math.round(ms / 60000));
  const tid = setTimeout(() => runLich(client, guildId, lich), ms);
  _setTimer(guildId, `${lich.id}_open`, tid);

  if (lich.close_day_of_week != null) {
    const msClose = msToNextOccurrence(lich.close_day_of_week, lich.close_hour, lich.close_minute);
    if (msClose > ms) {
      log.info('SCHEDULER', guildId, '"%s" ĐÓNG sau %s phút (pre-scheduled)', lich.session_name, Math.round(msClose / 60000));
      const tidC = setTimeout(() => runDongLich(client, guildId, lich), msClose);
      _setTimer(guildId, `${lich.id}_close`, tidC);
    } else {
      log.debug('SCHEDULER', guildId, '"%s" close timer bỏ qua tại scheduleLich (close <= open), sẽ schedule sau khi open chạy', lich.session_name);
    }
  }
}

function _setTimer(guildId, key, tid) {
  if (!schedulerMap.has(guildId)) schedulerMap.set(guildId, new Map());
  const gMap = schedulerMap.get(guildId);
  const existing = gMap.get(key);
  if (existing != null) clearTimeout(existing);
  gMap.set(key, tid);
}

// ── GIAI ĐOẠN 1: Mở phiên ────────────────────────────────────────────────────
async function runLich(client, guildId, lich) {
  try {
    const lichHienTai = await db.getLichCoDinhById(guildId, lich.id);
    if (!lichHienTai) return;

    const g = client.guilds.cache.get(guildId);
    if (!g) {
      await scheduleLichCoDinh(client, guildId, lich);
      return;
    }

    const existing = await db.getActiveSession(guildId);
    if (existing) {
      log.info('SCHEDULER', guildId, '%s — bỏ qua mở vì đang có phiên: %s', g.name, existing.session_name);
      await scheduleLichCoDinh(client, guildId, lich);
      return;
    }

    await _moPhien(g, lich);

    if (lich.close_day_of_week != null) {
      const msClose = msFromOpenToClose(
        lich.day_of_week, lich.hour, lich.minute,
        lich.close_day_of_week, lich.close_hour, lich.close_minute
      );
      log.info('SCHEDULER', guildId, '%s — "%s" ĐÓNG sau %s phút (scheduled post-open)', g.name, lich.session_name, Math.round(msClose / 60000));
      const tidC = setTimeout(() => runDongLich(client, guildId, lich), msClose);
      _setTimer(guildId, `${lich.id}_close`, tidC);
    }
  } catch (e) {
    log.error('SCHEDULER', guildId, 'Lỗi runLich %s: %s', lich.id, e.message);
  }
  await scheduleLichCoDinh(client, guildId, lich);
}

// ── Logic mở phiên ────────────────────────────────────────────────────────────
async function _moPhien(g, lich) {
  await g.members.fetch();
  const cfg = await db.getConfig(g.id);
  let eligibleMembers;
  if (cfg.allowed_role_id) {
    const role = g.roles.cache.get(cfg.allowed_role_id);
    eligibleMembers = role ? [...role.members.values()] : [];
  } else {
    eligibleMembers = [...g.members.cache.filter(m => !m.user.bot).values()];
  }
  const eligibleIds = eligibleMembers.map(m => m.id);
  if (!eligibleIds.length) return;

  const roleName = cfg.allowed_role_id
    ? (g.roles.cache.get(cfg.allowed_role_id)?.name ?? 'Role không rõ')
    : 'Tất cả';

  const session = await db.createSession(g.id, {
    sessionName:       lich.session_name,
    roleName,
    allowedRoleId:     cfg.allowed_role_id ?? null,
    eligibleMemberIds: eligibleIds,
    startedBy:         'scheduler',
    lichId:            lich.id,
  });

  const ch = await g.channels.fetch(lich.channel_id).catch(() => null);
  if (!ch) return;

  const embed = buildSessionEmbed(session, eligibleIds.length, roleName);
  const row   = buildAttendanceButtons(false);
  const msg   = await ch.send({ embeds: [embed], components: [row] });
  await db.setSessionMessageId(session.id, msg.id, ch.id);
  log.info('SCHEDULER', g.id, '%s — ĐÃ MỞ phiên: %s', g.name, lich.session_name);
}

// ── GIAI ĐOẠN 2: Đóng phiên ──────────────────────────────────────────────────
async function runDongLich(client, guildId, lich) {
  try {
    const g = client.guilds.cache.get(guildId);
    if (!g) {
      _rescheduleClose(client, guildId, lich);
      return;
    }

    const session = await db.getActiveSession(guildId);
    if (!session) {
      log.info('SCHEDULER', guildId, '%s — không có phiên đang mở để đóng', g.name);
      _rescheduleClose(client, guildId, lich);
      return;
    }

    const nameMatch    = session.session_name === lich.session_name;
    const channelMatch = session.channel_id   === lich.channel_id;
    if (!nameMatch || !channelMatch) {
      log.info('SCHEDULER', guildId, '%s — phiên "%s" không khớp lịch "%s" (name:%s ch:%s), bỏ qua',
        g.name, session.session_name, lich.session_name, nameMatch, channelMatch);
      _rescheduleClose(client, guildId, lich);
      return;
    }

    const ch = await g.channels.fetch(lich.channel_id).catch(() => null);
    if (!ch) {
      _rescheduleClose(client, guildId, lich);
      return;
    }

    await _dongPhienVaThongKe(g, session, ch, lich, client);
  } catch (e) {
    log.error('SCHEDULER', guildId, 'Lỗi runDongLich %s: %s', lich.id, e.message);
  }
  _rescheduleClose(client, guildId, lich);
}

// ── Logic đóng phiên + thống kê ───────────────────────────────────────────────
async function _dongPhienVaThongKe(g, session, ch, lich, client) {
  const attended = await db.getAttendances(session.id);
  await ketThucPhien(g, session, attended);
  await voHieuHoaNutDiemDanh(client, ch, session);

  await g.members.fetch();
  const phaiBattleMap = new Map();
  const phaRoleIds    = lich.phai_role_ids ?? [];
  const daThamGia     = attended.filter(a => ['tham_gia', 'tre'].includes(a.status));

  if (phaRoleIds.length > 0) {
    for (const roleId of phaRoleIds) {
      const role = g.roles.cache.get(roleId);
      if (!role) continue;
      const members = daThamGia.filter(a => g.members.cache.get(a.user_id)?.roles.cache.has(roleId));
      phaiBattleMap.set(role.name, members.map(a => a.user_id));
    }
  } else {
    for (const att of daThamGia) {
      const member = g.members.cache.get(att.user_id);
      if (!member) { _addToPhai(phaiBattleMap, 'Không rõ', att.user_id); continue; }
      const topRole = member.roles.cache
        .filter(r => r.id !== g.id)
        .sort((a, b) => b.position - a.position)
        .first();
      _addToPhai(phaiBattleMap, topRole?.name ?? 'Không có role', att.user_id);
    }
  }

  const tongThamGia = daThamGia.length;
  const tongVang    = attended.filter(a => a.status === 'khong_tham_gia').length;
  const tongPhep    = attended.filter(a => a.status === 'co_phep').length;

  const phaiLines = [...phaiBattleMap.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([phai, ids]) => {
      const list = ids.map(id => `<@${id}>`).join(' ');
      return `**${phai}** — ${ids.length} người\n${list || '_(trống)_'}`;
    }).join('\n\n') || '_Không có dữ liệu_';

  const embed = new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle(`⚔️ ${session.session_name} — Chốt Danh Sách`)
    .setDescription([
      `📊 **Tổng điểm danh:** ${tongThamGia} người`,
      `❌ Vắng: ${tongVang} | 📋 Có phép: ${tongPhep}`,
      '',
      '**── THỐNG KÊ THEO PHÁI ──**',
      phaiLines,
    ].join('\n'))
    .setColor(0xE74C3C)
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  await ch.send({ embeds: [embed] });
  log.info('SCHEDULER', g.id, '%s — ĐÃ ĐÓNG & thống kê: %s', g.name, session.session_name);
}

// ── BUG #1/#8 FIX: reschedule close 1 chu kỳ đầy đủ từ open ─────────────────
function _rescheduleClose(client, guildId, lich) {
  const msClose = msFromOpenToClose(
    lich.day_of_week, lich.hour, lich.minute,
    lich.close_day_of_week, lich.close_hour, lich.close_minute
  );
  log.info('SCHEDULER', guildId, '"%s" ĐÓNG (tiếp) sau %s phút', lich.session_name, Math.round(msClose / 60000));
  const tidC = setTimeout(() => runDongLich(client, guildId, lich), msClose);
  _setTimer(guildId, `${lich.id}_close`, tidC);
}

function _addToPhai(map, phai, userId) {
  if (!map.has(phai)) map.set(phai, []);
  map.get(phai).push(userId);
}

// ── Hủy lịch ──────────────────────────────────────────────────────────────────
function cancelLichCoDinh(guildId, lichId) {
  const gMap = schedulerMap.get(guildId);
  if (!gMap) return;
  for (const key of [`${lichId}_open`, `${lichId}_close`]) {
    const tid = gMap.get(key);
    if (tid) { clearTimeout(tid); gMap.delete(key); }
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

  if (msRemaining <= 0) {
    log.info('SCHEDULER', guild.id, '%s — phiên "%s" đã qua giờ đóng khi offline, đóng ngay', guild.name, session.session_name);
    setImmediate(() => runDongLich(client, guild.id, lich));
  } else {
    log.info('SCHEDULER', guild.id, '%s — khôi phục close timer "%s" sau %s phút', guild.name, session.session_name, Math.round(msRemaining / 60000));
    const tidC = setTimeout(() => runDongLich(client, guild.id, lich), msRemaining);
    _setTimer(guild.id, `${lich.id}_close`, tidC);
  }
}

// ── Khôi phục khi bot restart ─────────────────────────────────────────────────
async function khoiPhucScheduler(client) {
  for (const guild of client.guilds.cache.values()) {
    try {
      const danhSach = await db.getLichCoDinh(guild.id);
      for (const lich of danhSach) {
        await scheduleLichCoDinh(client, guild.id, lich);
      }
      if (danhSach.length > 0) {
        log.info('SCHEDULER', guild.id, '%s — khôi phục %s lịch cố định', guild.name, danhSach.length);
        await _khoiPhucCloseTimer(client, guild, danhSach);
      }
    } catch (e) {
      log.error('SCHEDULER', guild.id, 'Lỗi khôi phục guild: %s', e.message);
    }
  }
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────
async function runLichNgay(client, guildId, lich) {
  const g = client.guilds.cache.get(guildId);
  if (!g) throw new Error('Guild không tìm thấy');
  await _moPhien(g, lich);
  if (lich.close_day_of_week != null) {
    const msClose = msFromOpenToClose(
      lich.day_of_week, lich.hour, lich.minute,
      lich.close_day_of_week, lich.close_hour, lich.close_minute
    );
    log.info('SCHEDULER', guildId, '%s — "%s" ĐÓNG sau %s phút (manual open)', g.name, lich.session_name, Math.round(msClose / 60000));
    const tidC = setTimeout(() => runDongLich(client, guildId, lich), msClose);
    _setTimer(guildId, `${lich.id}_close`, tidC);
  }
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
