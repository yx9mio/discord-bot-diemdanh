// utils/scheduler.js — Lịch cố định tự động mở/đóng phiên
// Fix #1: clear timer cũ trước khi set mới (tránh zombie timer)
// Fix #2: _rescheduleClose dùng msToCloseFromNow (không tính lại từ đầu chu kỳ)
// Fix #3: _dongPhienVaThongKe gọi thongBaoHuyHieu + guiCsvDinhKem
// Fix #4: loại bỏ ephemeral deprecated warning khỏi handler setup
'use strict';
const { EmbedBuilder, MessageFlags } = require('discord.js');
const db  = require('../db.js');
const log = require('./logger.js');
const { msToNextWeekday, msFromOpenToClose, msToCloseFromNow } = require('./timeCalc.js');
const { buildSessionEmbed, buildAttendanceButtons, buildSummaryEmbed } = require('./embeds.js');
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
  log.info('SCHEDULER', guildId, '"Lịch" %s — MỮ sau %s phút', lich.session_name, Math.round(msOpen / 60000));

  const tidO = setTimeout(async () => {
    try {
      const g = client.guilds.cache.get(guildId);
      if (!g) {
        // Guild không có trong cache: re-queue cho lần sau
        await scheduleLichCoDinh(client, guildId, lich);
        return;
      }
      await _moPhien(g, lich);
      if (lich.close_day_of_week != null) {
        const msClose = msFromOpenToClose(
          lich.day_of_week, lich.hour, lich.minute,
          lich.close_day_of_week, lich.close_hour, lich.close_minute
        );
        log.info('SCHEDULER', guildId, '"%s" ĐÓNG sau %s phút', lich.session_name, Math.round(msClose / 60000));
        const tidC = setTimeout(() => runDongLich(client, guildId, lich), msClose);
        _setTimer(guildId, `${lich.id}_close`, tidC);
      } else {
        // Không có close tự động: re-queue open cho cycle tiếp theo
        await scheduleLichCoDinh(client, guildId, lich);
      }
    } catch (e) {
      log.error('SCHEDULER', guildId, 'Lỗi _moPhien scheduled: %s', e.message);
      await scheduleLichCoDinh(client, guildId, lich);
    }
  }, msOpen);
  _setTimer(guildId, `${lich.id}_open`, tidO);
}

// ── GIAI ĐOẠN 1a: Mở phiên ────────────────────────────────────────────────────
async function _moPhien(g, lich) {
  // Guard double-open — skip nếu đã có phiên cùng session_name đang mở
  const existing = await db.getActiveSession(g.id);
  if (existing && existing.session_name === lich.session_name) {
    log.info('SCHEDULER', g.id, '%s — bỏ qua mở phiên "%s" (đã tồn tại)', g.name, lich.session_name);
    return;
  }

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

  const session = await db.createSession(
    g.id,
    lich.session_name,
    'scheduler',
    null,
    lich.channel_id,
    eligibleIds,
  );

  const patch = {};
  if (cfg.allowed_role_id) {
    patch.allowed_role_id = cfg.allowed_role_id;
    patch.role_name = roleName;
  }
  if (lich.id) patch.lich_id = lich.id;
  if (Object.keys(patch).length) {
    await db.supabase.from('sessions').update(patch).eq('id', session.id);
    Object.assign(session, patch);
  }

  const ch = await g.channels.fetch(lich.channel_id).catch(() => null);
  if (!ch) return;

  const embed = await buildSessionEmbed(g, session, [], lich.phai_role_ids ?? []);
  const row   = buildAttendanceButtons(false);
  const msg   = await ch.send({ embeds: [embed], components: [row] });

  await db.updateSessionMessageId(session.id, msg.id);
  log.info('SCHEDULER', g.id, '%s — ĐÃ MỮ phiên: %s', g.name, lich.session_name);
}

// ── GIAI ĐOẠN 2: Đóng phiên ────────────────────────────────────────────────────
async function runDongLich(client, guildId, lich) {
  try {
    const g = client.guilds.cache.get(guildId);
    if (!g) {
      _rescheduleClose(client, guildId, lich);
      return;
    }

    const session = await db.getActiveSession(guildId);
    if (!session) {
      log.warn('SCHEDULER', guildId, 'runDongLich: không có phiên active — re-queue open');
      await scheduleLichCoDinh(client, guildId, lich);
      return;
    }

    const ch = await g.channels.fetch(lich.channel_id).catch(() => null);
    if (!ch) {
      _rescheduleClose(client, guildId, lich, session);
      return;
    }

    await _dongPhienVaThongKe(g, session, ch, lich, client);
  } catch (e) {
    log.error('SCHEDULER', guildId, 'Lỗi runDongLich %s: %s', lich.id, e.message);
    _rescheduleClose(client, guildId, lich);
  }
}

// FIX #3: thêm thongBaoHuyHieu + guiCsvDinhKem (giống timers.js)
async function _dongPhienVaThongKe(g, session, ch, lich, client) {
  const attended = await db.getAttendances(session.id);
  const statsMap = await ketThucPhien(g, session, attended);
  await voHieuHoaNutDiemDanh(client, ch, session);

  const tongThamGia = attended.filter(a => ['tham_gia', 'tre'].includes(a.status)).length;
  const tongVang    = (session.eligible_member_ids?.length ?? 0) - tongThamGia;
  const tongPhep    = attended.filter(a => a.status === 'co_phep').length;

  const phaiRoleIds = lich.phai_role_ids ?? [];
  const phaiMap     = new Map();
  for (const a of attended) {
    if (!['tham_gia', 'tre'].includes(a.status)) continue;
    const member = g.members.cache.get(a.user_id);
    if (!member) continue;
    for (const rid of phaiRoleIds) {
      if (member.roles.cache.has(rid)) _addToPhai(phaiMap, rid, a.user_id);
    }
  }
  const phaiLines = phaiRoleIds.map(rid => {
    const role    = g.roles.cache.get(rid);
    const members = phaiMap.get(rid) ?? [];
    return `<@&${rid}> — **${members.length}** người *(${role?.name ?? rid})*`;
  }).join('\n') || '_Không có phái_';

  const summaryEmbed = buildSummaryEmbed(session, attended, g, phaiRoleIds);
  const closedEmbed  = new EmbedBuilder()
    .setTitle('\uD83D\uDD12 Phiên đã kết thúc tự động')
    .setDescription([
      `✅ Tham gia: ${tongThamGia} | ❌ Vắng: ${tongVang} | 📋 Có phép: ${tongPhep}`,
      '',
      '**── THỐNG KÊ THEO PHÁI ──**',
      phaiLines,
    ].join('\n'))
    .setColor(0xE74C3C)
    .setFooter({ text: 'Quản Gia' })
    .setTimestamp();

  await ch.send({ embeds: [closedEmbed, summaryEmbed] });

  // FIX #3: trao badge + gửi CSV (như timers.js)
  await thongBaoHuyHieu(g, ch, g.id, session.id, attended, statsMap);
  await _guiCsv(ch, session, attended);

  log.info('SCHEDULER', g.id, '%s — ĐÃ ĐÓNG & thống kê: %s', g.name, session.session_name);

  // Re-queue open timer cho cycle tiếp theo
  setImmediate(() => scheduleLichCoDinh(client, g.id, lich).catch(e =>
    log.error('SCHEDULER', g.id, 'Lỗi re-queue open sau đóng: %s', e.message)
  ));
}

// ── CSV helper (inline, không phụ thuộc timers.js) ───────────────────────────
async function _guiCsv(ch, session, attended) {
  try {
    const STATUS_LABEL = {
      tham_gia: 'Có mặt',
      tre:      'Trễ',
      co_phep:  'Có phép',
      vang:     'Vắng',
    };
    const header = 'UserID,Trạng thái,Thời gian';
    const rows   = attended.map(a =>
      `${a.user_id},${STATUS_LABEL[a.status] ?? a.status},${a.created_at ?? ''}`
    );
    const csv = [header, ...rows].join('\n');
    const buf = Buffer.from(csv, 'utf-8');
    const { AttachmentBuilder } = require('discord.js');
    const date = new Date().toISOString().slice(0, 10);
    const file = new AttachmentBuilder(buf, { name: `diemdanh_${date}.csv` });
    await ch.send({ content: '\uD83D\uDCCE **Bảng điểm danh**', files: [file] });
  } catch (e) {
    log.warn('SCHEDULER', session.guild_id, 'Không gửi được CSV: %s', e.message);
  }
}

// FIX #2: reschedule close dùng ms còn lại từ hiện tại (không tính lại từ open)
function _rescheduleClose(client, guildId, lich, session = null) {
  let msClose;
  if (session?.created_at && lich.close_day_of_week != null) {
    // Dùng msToCloseFromNow — ms còn lại tính từ lúc phiên mở
    msClose = msToCloseFromNow(
      lich.day_of_week, lich.hour, lich.minute,
      lich.close_day_of_week, lich.close_hour, lich.close_minute,
      session.created_at
    );
    if (msClose <= 0) msClose = 5000; // đã qua giờ: chờ 5s rồi đóng ngay
  } else {
    // Fallback: toàn bộ chu kỳ
    msClose = msFromOpenToClose(
      lich.day_of_week, lich.hour, lich.minute,
      lich.close_day_of_week, lich.close_hour, lich.close_minute
    );
  }
  log.info('SCHEDULER', guildId, '"%s" ĐÓNG (tiếp) sau %s phút', lich.session_name, Math.round(msClose / 60000));
  const tidC = setTimeout(() => runDongLich(client, guildId, lich), msClose);
  _setTimer(guildId, `${lich.id}_close`, tidC);
}

function _addToPhai(map, phai, userId) {
  if (!map.has(phai)) map.set(phai, []);
  map.get(phai).push(userId);
}

// ── Hủy lịch ────────────────────────────────────────────────────────────────────────────
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

// ── PUBLIC API ──────────────────────────────────────────────────────────────────────────
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
