// utils/scheduler.js — Lịch cố định 2 giai đoạn: mở phiên + đóng & thống kê phái
const db = require('../db.js');
const { buildSessionEmbed, buildAttendanceButtons, FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('./embeds.js');
const { ketThucPhien, voHieuHoaNutDiemDanh } = require('./session.js');
const { EmbedBuilder } = require('discord.js');

// Map<guildId, Map<lichId_open | lichId_close, timeoutId>>
const schedulerMap = new Map();

// ── Tính ms đến lần chạy tiếp theo (giờ VN) ──────────────────────────────────
// dayOfWeek: 0=CN, 1=T2...6=T7 | hour/minute: giờ VN (UTC+7)
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

// ── Lên lịch 1 lịch cố định (gồm cả 2 giai đoạn nếu có close_*) ─────────────
async function scheduleLichCoDinh(client, guild, lich) {
  const ms = msToNextOccurrence(lich.day_of_week, lich.hour, lich.minute);
  console.log(`[Scheduler] ${guild.name} — "${lich.session_name}" MỞ sau ${Math.round(ms/60000)}p`);
  const tid = setTimeout(() => runLich(client, guild, lich), ms);
  _setTimer(guild.id, `${lich.id}_open`, tid);

  // Nếu có giờ đóng → lên lịch đóng độc lập
  if (lich.close_day_of_week != null) {
    const msClose = msToNextOccurrence(lich.close_day_of_week, lich.close_hour, lich.close_minute);
    console.log(`[Scheduler] ${guild.name} — "${lich.session_name}" ĐÓNG sau ${Math.round(msClose/60000)}p`);
    const tidC = setTimeout(() => runDongLich(client, guild, lich), msClose);
    _setTimer(guild.id, `${lich.id}_close`, tidC);
  }
}

function _setTimer(guildId, key, tid) {
  if (!schedulerMap.has(guildId)) schedulerMap.set(guildId, new Map());
  schedulerMap.get(guildId).set(key, tid);
}

// ── GIA ĐOẠN 1: Mở phiên điểm danh ──────────────────────────────────────────
async function runLich(client, guild, lich) {
  try {
    const lichHienTai = await db.getLichCoDinhById(lich.guild_id, lich.id);
    if (!lichHienTai) return;

    const g = client.guilds.cache.get(lich.guild_id);
    if (!g) { await scheduleLichCoDinh(client, guild, lich); return; }

    const existing = await db.getActiveSession(lich.guild_id);
    if (existing) {
      console.log(`[Scheduler] ${g.name} — bỏ qua mở vì đang có phiên: ${existing.session_name}`);
      await scheduleLichCoDinh(client, g, lich);
      return;
    }

    await g.members.fetch();
    const cfg = await db.getConfig(lich.guild_id);
    let eligibleMembers;
    if (cfg.allowed_role_id) {
      const role = g.roles.cache.get(cfg.allowed_role_id);
      eligibleMembers = role ? [...role.members.values()] : [];
    } else {
      eligibleMembers = [...g.members.cache.filter(m => !m.user.bot).values()];
    }
    const eligibleIds = eligibleMembers.map(m => m.id);
    if (!eligibleIds.length) { await scheduleLichCoDinh(client, g, lich); return; }

    const roleName = cfg.allowed_role_id
      ? (g.roles.cache.get(cfg.allowed_role_id)?.name ?? 'Role không rõ')
      : 'Tất cả';

    const session = await db.createSession(lich.guild_id, {
      sessionName:       lich.session_name,
      roleName,
      allowedRoleId:     cfg.allowed_role_id ?? null,
      eligibleMemberIds: eligibleIds,
      startedBy:         client.user.id,
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
  } catch (e) {
    console.error(`[Scheduler] Lỗi runLich ${lich.id}:`, e.message);
  }
  // Lên lịch mở tuần sau
  await scheduleLichCoDinh(client, guild, lich);
}

// ── GIAI ĐOẠN 2: Đóng phiên + thống kê theo phái (role Discord) ──────────────
async function runDongLich(client, guild, lich) {
  try {
    const g = client.guilds.cache.get(lich.guild_id);
    if (!g) {
      _rescheduleClose(client, guild, lich);
      return;
    }

    const session = await db.getActiveSession(lich.guild_id);
    if (!session || session.session_name !== lich.session_name) {
      console.log(`[Scheduler] ${g.name} — không có phiên "${lich.session_name}" để đóng`);
      _rescheduleClose(client, g, lich);
      return;
    }

    const ch = await g.channels.fetch(lich.channel_id).catch(() => null);
    if (!ch) {
      _rescheduleClose(client, g, lich);
      return;
    }

    const attended = await db.getAttendances(session.id);
    await ketThucPhien(g, session, attended);
    await voHieuHoaNutDiemDanh(client, ch, session);

    // Thống kê theo phái (role Discord)
    await g.members.fetch();
    const phaiBattleMap = new Map();

    const phaRoleIds = lich.phai_role_ids ?? [];
    const daThamGia  = attended.filter(a => ['tham_gia', 'tre'].includes(a.status));

    if (phaRoleIds.length > 0) {
      for (const roleId of phaRoleIds) {
        const role = g.roles.cache.get(roleId);
        if (!role) continue;
        const members = daThamGia.filter(a => {
          const member = g.members.cache.get(a.user_id);
          return member?.roles.cache.has(roleId);
        });
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
        const phai = topRole?.name ?? 'Không có role';
        _addToPhai(phaiBattleMap, phai, att.user_id);
      }
    }

    const tongThamGia = daThamGia.length;
    // [B8 FIX] status DB là 'khong_tham_gia', KHÔNG phải 'vang'
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
  } catch (e) {
    console.error(`[Scheduler] Lỗi runDongLich ${lich.id}:`, e.message);
  }
  _rescheduleClose(client, guild, lich);
}

// ── Helper reschedule close ───────────────────────────────────────────────────
function _rescheduleClose(client, guild, lich) {
  const msClose = msToNextOccurrence(lich.close_day_of_week, lich.close_hour, lich.close_minute);
  console.log(`[Scheduler] ${guild.name} — "${lich.session_name}" ĐÓNG (tiếp) sau ${Math.round(msClose/60000)}p`);
  const tidC = setTimeout(() => runDongLich(client, guild, lich), msClose);
  _setTimer(guild.id, `${lich.id}_close`, tidC);
}

function _addToPhai(map, phai, userId) {
  if (!map.has(phai)) map.set(phai, []);
  map.get(phai).push(userId);
}

// ── Hủy lịch ─────────────────────────────────────────────────────────────────
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

// ── Khởi phục khi bot restart ─────────────────────────────────────────────────
async function khoiPhucScheduler(client) {
  for (const guild of client.guilds.cache.values()) {
    try {
      const danhSach = await db.getLichCoDinh(guild.id);
      for (const lich of danhSach) {
        await scheduleLichCoDinh(client, guild, lich);
      }
      if (danhSach.length > 0)
        console.log(`[Scheduler] ${guild.name} — khôi phục ${danhSach.length} lịch cố định`);
    } catch (e) {
      console.error(`[Scheduler] Lỗi khôi phục guild ${guild.id}:`, e.message);
    }
  }
}

module.exports = { scheduleLichCoDinh, cancelLichCoDinh, khoiPhucScheduler };
