// utils/scheduler.js — Lịch cố định 2 giai đoạn: mở phiên + đóng & thống kê phái
const db = require('../db.js');
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
// VD BC: mở T7 21:00, đóng T7 19:30 cùng ngày
//   openMinTotal  = 6*24*60 + 21*60 + 0  = 9780
//   closeMinTotal = 6*24*60 + 19*60 + 30 = 9690
//   deltaMin = (9690 - 9780 + 10080) % 10080 = 9990 phút = 6d 22h 30m ✓
function msFromOpenToClose(openDay, openHour, openMinute, closeDay, closeHour, closeMinute) {
  const openMinTotal  = openDay  * 24 * 60 + openHour  * 60 + openMinute;
  const closeMinTotal = closeDay * 24 * 60 + closeHour * 60 + closeMinute;

  let deltaMin = (closeMinTotal - openMinTotal + 7 * 24 * 60) % (7 * 24 * 60);
  if (deltaMin === 0) deltaMin = 7 * 24 * 60;

  return deltaMin * 60 * 1000;
}

// ── Tính ms từ NOW đến thời điểm close của phiên đang mở (khi restart) ───────
// Biết session.created_at (= thời điểm open thực tế), tính deadline close = open + delta
function msToCloseFromNow(openDay, openHour, openMinute, closeDay, closeHour, closeMinute, sessionCreatedAt) {
  const deltaMs    = msFromOpenToClose(openDay, openHour, openMinute, closeDay, closeHour, closeMinute);
  const openTime   = new Date(sessionCreatedAt).getTime();
  const closeTime  = openTime + deltaMs;
  return closeTime - Date.now();
}

// ── Lên lịch open ─────────────────────────────────────────────────────────────
async function scheduleLichCoDinh(client, guildId, lich) {
  const ms = msToNextOccurrence(lich.day_of_week, lich.hour, lich.minute);
  console.log(`[Scheduler] guild:${guildId} — "${lich.session_name}" MỞ sau ${Math.round(ms / 60000)}p`);
  const tid = setTimeout(() => runLich(client, guildId, lich), ms);
  _setTimer(guildId, `${lich.id}_open`, tid);

  // Pre-schedule close chỉ khi close xảy ra SAU open trong tuần này
  // (trường hợp BC: closeHour < openHour cùng ngày → msClose < ms → bỏ qua, schedule sau khi open chạy)
  if (lich.close_day_of_week != null) {
    const msClose = msToNextOccurrence(lich.close_day_of_week, lich.close_hour, lich.close_minute);
    if (msClose > ms) {
      console.log(`[Scheduler] guild:${guildId} — "${lich.session_name}" ĐÓNG sau ${Math.round(msClose / 60000)}p (pre-scheduled)`);
      const tidC = setTimeout(() => runDongLich(client, guildId, lich), msClose);
      _setTimer(guildId, `${lich.id}_close`, tidC);
    } else {
      console.log(`[Scheduler] guild:${guildId} — "${lich.session_name}" close timer bỏ qua tại scheduleLich (close <= open hoặc cùng ngày giờ đóng < giờ mở), sẽ schedule sau khi open chạy`);
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
      console.log(`[Scheduler] ${g.name} — bỏ qua mở vì đang có phiên: ${existing.session_name}`);
      await scheduleLichCoDinh(client, guildId, lich);
      return;
    }

    await _moPhien(g, lich);

    // BUG #1/#8 FIX: schedule close SAU KHI open thành công bằng delta chính xác
    if (lich.close_day_of_week != null) {
      const msClose = msFromOpenToClose(
        lich.day_of_week, lich.hour, lich.minute,
        lich.close_day_of_week, lich.close_hour, lich.close_minute
      );
      console.log(`[Scheduler] ${g.name} — "${lich.session_name}" ĐÓNG sau ${Math.round(msClose / 60000)}p (scheduled post-open)`);
      const tidC = setTimeout(() => runDongLich(client, guildId, lich), msClose);
      _setTimer(guildId, `${lich.id}_close`, tidC);
    }
  } catch (e) {
    console.error(`[Scheduler] Lỗi runLich ${lich.id}:`, e.message);
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
    autoCloseAt:       null,
    channelId:         lich.channel_id,
  });

  const ch = await g.channels.fetch(lich.channel_id).catch(() => null);
  if (ch) {
    const embed   = await buildSessionEmbed(g, session, []);
    const buttons = buildAttendanceButtons(false);
    const msg = await ch.send({ embeds: [embed], components: [buttons] });
    await db.updateSessionMessageId(session.id, msg.id);
    console.log(`[Scheduler] ${g.name} — ĐÃ MỞ phiên: ${lich.session_name}`);
  }
}

// ── GIAI ĐOẠN 2: Đóng phiên + thống kê phái ──────────────────────────────────
async function runDongLich(client, guildId, lich) {
  try {
    const g = client.guilds.cache.get(guildId);
    if (!g) {
      _rescheduleClose(client, guildId, lich);
      return;
    }

    const session = await db.getActiveSession(guildId);
    if (!session) {
      console.log(`[Scheduler] ${g.name} — không có phiên đang mở để đóng`);
      _rescheduleClose(client, guildId, lich);
      return;
    }

    const nameMatch    = session.session_name === lich.session_name;
    const channelMatch = session.channel_id   === lich.channel_id;
    if (!nameMatch || !channelMatch) {
      console.log(`[Scheduler] ${g.name} — phiên "${session.session_name}" không khớp lịch "${lich.session_name}" (name:${nameMatch} ch:${channelMatch}), bỏ qua`);
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
    console.error(`[Scheduler] Lỗi runDongLich ${lich.id}:`, e.message);
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
  console.log(`[Scheduler] ${g.name} — ĐÃ ĐÓNG & thống kê: ${session.session_name}`);
}

// ── BUG #1/#8 FIX: reschedule close 1 chu kỳ đầy đủ từ open ─────────────────
function _rescheduleClose(client, guildId, lich) {
  const msClose = msFromOpenToClose(
    lich.day_of_week, lich.hour, lich.minute,
    lich.close_day_of_week, lich.close_hour, lich.close_minute
  );
  console.log(`[Scheduler] guild:${guildId} — "${lich.session_name}" ĐÓNG (tiếp) sau ${Math.round(msClose / 60000)}p`);
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
  console.log(`[Scheduler] Đã hủy lịch ${lichId} của guild ${guildId}`);
}

// ── PATCH: Khôi phục close timer cho phiên lịch cố định đang mở khi restart ──
// Vấn đề: khoiPhucHenGio() (ready.js) chỉ xử lý session có auto_close_at.
// Session mở bởi scheduler có auto_close_at = null → close timer bị mất sau restart.
// Fix: sau khi scheduleLichCoDinh() chạy xong, kiểm tra xem có active session
// nào khớp với lịch đó không. Nếu có → tính lại ms đến close và set timer.
async function _khoiPhucCloseTimer(client, guild, danhSach) {
  const session = await db.getActiveSession(guild.id);
  // Chỉ xử lý session do scheduler tạo (startedBy = 'scheduler'), không có auto_close_at
  if (!session || session.started_by !== 'scheduler' || session.auto_close_at) return;

  const lich = danhSach.find(
    l => l.session_name === session.session_name && l.channel_id === session.channel_id
  );
  if (!lich || lich.close_day_of_week == null) return;

  // Tránh tạo timer trùng nếu pre-schedule đã set
  const gMap = schedulerMap.get(guild.id);
  if (gMap?.has(`${lich.id}_close`)) return;

  const msRemaining = msToCloseFromNow(
    lich.day_of_week, lich.hour, lich.minute,
    lich.close_day_of_week, lich.close_hour, lich.close_minute,
    session.created_at
  );

  if (msRemaining <= 0) {
    // Đã qua mốc close trong lúc offline → đóng ngay
    console.log(`[Scheduler] ${guild.name} — phiên "${session.session_name}" đã qua giờ đóng khi offline, đóng ngay`);
    setImmediate(() => runDongLich(client, guild.id, lich));
  } else {
    console.log(`[Scheduler] ${guild.name} — khôi phục close timer "${session.session_name}" sau ${Math.round(msRemaining / 60000)}p`);
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
        console.log(`[Scheduler] ${guild.name} — khôi phục ${danhSach.length} lịch cố định`);
        // PATCH: khôi phục close timer cho phiên đang mở (nếu có)
        await _khoiPhucCloseTimer(client, guild, danhSach);
      }
    } catch (e) {
      console.error(`[Scheduler] Lỗi khôi phục guild ${guild.id}:`, e.message);
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
    console.log(`[Scheduler] ${g.name} — "${lich.session_name}" ĐÓNG sau ${Math.round(msClose / 60000)}p (manual open)`);
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
