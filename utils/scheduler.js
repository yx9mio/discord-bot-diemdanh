// utils/scheduler.js — Lên lịch điểm danh cố định hằng tuần
// Logic: mỗi lịch = 1 setTimeout đến lần chạy tiếp theo → sau khi chạy tự lên lịch lần sau
const db = require('../db.js');
const { datHenGioDong } = require('./timers.js');
const { buildSessionEmbed, buildAttendanceButtons } = require('./embeds.js');

// Map<guildId, Map<lichId, timeoutId>>
const schedulerMap = new Map();

// ── Tính ms đến lần chạy tiếp theo của lịch cố định (giờ VN) ─────────────────
function msToNextOccurrence(dayOfWeek, hour, minute) {
  const VN_OFFSET = 7 * 60 * 60 * 1000;
  const nowUtc    = Date.now();
  const nowVn     = new Date(nowUtc + VN_OFFSET);

  // Thứ hiện tại (VN), 0=CN
  const curDay  = nowVn.getUTCDay();
  const curH    = nowVn.getUTCHours();
  const curM    = nowVn.getUTCMinutes();
  const curS    = nowVn.getUTCSeconds();
  const curMs   = nowVn.getUTCMilliseconds();

  let daysUntil = (dayOfWeek - curDay + 7) % 7;

  // Nếu đúng thứ này nhưng giờ đã qua → tuần sau
  if (daysUntil === 0) {
    const secPassed = curH * 3600 + curM * 60 + curS;
    const secTarget = hour * 3600 + minute * 60;
    if (secPassed >= secTarget) daysUntil = 7;
  }

  // Tính target UTC
  const nowVnMidnight = nowUtc + VN_OFFSET - (curH * 3600 + curM * 60 + curS) * 1000 - curMs;
  const targetVnMs    = nowVnMidnight + daysUntil * 86400000 + hour * 3600000 + minute * 60000;
  const targetUtcMs   = targetVnMs - VN_OFFSET;

  return targetUtcMs - nowUtc;
}

// ── Lên lịch 1 lịch cố định ──────────────────────────────────────────────────
async function scheduleLichCoDinh(client, guild, lich) {
  const ms = msToNextOccurrence(lich.day_of_week, lich.hour, lich.minute);
  console.log(`[Scheduler] ${guild.name} — "${lich.session_name}" sẽ chạy sau ${Math.round(ms/60000)} phút`);

  const timeoutId = setTimeout(() => runLich(client, guild, lich), ms);

  if (!schedulerMap.has(guild.id)) schedulerMap.set(guild.id, new Map());
  schedulerMap.get(guild.id).set(lich.id, timeoutId);
}

// ── Thực thi mở phiên khi đến giờ ────────────────────────────────────────────
async function runLich(client, guild, lich) {
  try {
    // Kiểm tra lịch còn tồn tại không (có thể đã bị xóa)
    const lichHienTai = await db.getLichCoDinhById(lich.guild_id, lich.id);
    if (!lichHienTai) return;

    // Kiểm tra guild còn online
    const g = client.guilds.cache.get(lich.guild_id);
    if (!g) { await scheduleLichCoDinh(client, guild, lich); return; }

    // Nếu đang có phiên active → bỏ qua lần này, vẫn lên lịch tuần sau
    const existing = await db.getActiveSession(lich.guild_id);
    if (existing) {
      console.log(`[Scheduler] ${g.name} — bỏ qua vì đang có phiên active: ${existing.session_name}`);
      await scheduleLichCoDinh(client, g, lich);
      return;
    }

    // Lấy danh sách thành viên eligible
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

    if (eligibleIds.length === 0) {
      console.log(`[Scheduler] ${g.name} — không có thành viên eligible, bỏ qua.`);
      await scheduleLichCoDinh(client, g, lich);
      return;
    }

    const roleName = cfg.allowed_role_id
      ? (g.roles.cache.get(cfg.allowed_role_id)?.name ?? 'Role không rõ')
      : 'Tất cả';

    // Thời điểm tự đóng
    const autoCloseAt = new Date(Date.now() + lich.duration_minutes * 60 * 1000).toISOString();

    // Tạo phiên
    const session = await db.createSession(lich.guild_id, {
      sessionName:      lich.session_name,
      roleName,
      allowedRoleId:    cfg.allowed_role_id ?? null,
      eligibleMemberIds: eligibleIds,
      startedBy:        client.user.id,
      autoCloseAt,
      channelId:        lich.channel_id,
    });

    // Gửi tin nhắn vào kênh
    const ch = await g.channels.fetch(lich.channel_id).catch(() => null);
    if (ch) {
      const embed   = await buildSessionEmbed(g, session, []);
      const buttons = buildAttendanceButtons(false);
      const msg = await ch.send({ embeds: [embed], components: [buttons] });
      await db.updateSessionMessageId(session.id, msg.id);

      // Hẹn giờ tự đóng
      await datHenGioDong(client, g, session, lich.channel_id, lich.duration_minutes * 60 * 1000);
      console.log(`[Scheduler] ${g.name} — đã mở phiên: ${lich.session_name}`);
    }
  } catch (e) {
    console.error(`[Scheduler] Lỗi runLich ${lich.id}:`, e.message);
  }

  // Lên lịch tuần sau
  await scheduleLichCoDinh(client, guild, lich);
}

// ── Hủy lịch ─────────────────────────────────────────────────────────────────
function cancelLichCoDinh(guildId, lichId) {
  const gMap = schedulerMap.get(guildId);
  if (!gMap) return;
  const tid = gMap.get(lichId);
  if (tid) { clearTimeout(tid); gMap.delete(lichId); }
  if (gMap.size === 0) schedulerMap.delete(guildId);
  console.log(`[Scheduler] Đã hủy lịch ${lichId} của guild ${guildId}`);
}

// ── Khởi phục toàn bộ lịch khi bot restart ───────────────────────────────────
async function khoiPhucScheduler(client) {
  for (const guild of client.guilds.cache.values()) {
    try {
      const danhSach = await db.getLichCoDinh(guild.id);
      for (const lich of danhSach) {
        await scheduleLichCoDinh(client, guild, lich);
      }
      if (danhSach.length > 0) {
        console.log(`[Scheduler] ${guild.name} — khôi phục ${danhSach.length} lịch cố định`);
      }
    } catch (e) {
      console.error(`[Scheduler] Lỗi khôi phục guild ${guild.id}:`, e.message);
    }
  }
}

module.exports = { scheduleLichCoDinh, cancelLichCoDinh, khoiPhucScheduler };
