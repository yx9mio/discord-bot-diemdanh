// utils/helpers.js — Hàm tiện ích dùng chung
'use strict';
const { PermissionFlagsBits } = require('discord.js');
const { toZonedTime }         = require('date-fns-tz');

const TZ = 'Asia/Ho_Chi_Minh';

// ─── Huy Hiệu ─────────────────────────────────────────────────
const MOC_HUY_HIEU = [
  { count: 5,   badge: '🌱', label: 'Lính Mới' },
  { count: 10,  badge: '⭐', label: 'Cần Cù' },
  { count: 20,  badge: '🌟', label: 'Chuyên Cần' },
  { count: 30,  badge: '💪', label: 'Kiên Trì' },
  { count: 50,  badge: '🏆', label: 'Huyền Thoại' },
  { count: 100, badge: '👑', label: 'Vua Điểm Danh' },
];

function layHuyHieu(count) {
  let badge = '';
  for (const m of MOC_HUY_HIEU) if (count >= m.count) badge = `${m.badge} ${m.label}`;
  return badge;
}

// ─── Quyền Admin ──────────────────────────────────────────────
function laAdmin(member, cfg) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (cfg?.admin_role_id && member.roles.cache.has(cfg.admin_role_id)) return true;
  return false;
}

/**
 * ms đến (ngày-trong-tháng, hour, minute) theo giờ VN.
 * Dùng date-fns-tz thay vì tính tay UTC+7.
 * @param {number|null} day     ngày trong tháng (null = hôm nay)
 * @param {number}      hour    0–23
 * @param {number}      minute  0–59
 */
function msDenGioVN(day, hour, minute) {
  const nowUtcMs = Date.now();
  const vnNow    = toZonedTime(new Date(nowUtcMs), TZ);

  const vnYear  = vnNow.getFullYear();
  const vnMonth = vnNow.getMonth();       // 0-indexed
  const vnDay   = vnNow.getDate();
  const targetDay = day ?? vnDay;

  // Build target timestamp trong TZ VN bằng cách tạo Date UTC tương ứng
  function buildTarget(year, month, d) {
    const maxDay = new Date(year, month + 1, 0).getDate();
    if (d > maxDay) return null;
    // Date constructor (local) không đáng tin — build bằng UTC rồi bù offset
    const offsetMs = vnNow.getTimezoneOffset() * -60 * 1000; // date-fns-tz set tzOffset
    const targetLocal = new Date(year, month, d, hour, minute, 0, 0);
    const targetUtcMs = targetLocal.getTime() - offsetMs;
    return { ms: targetUtcMs - nowUtcMs, targetDate: new Date(targetUtcMs) };
  }

  let result = buildTarget(vnYear, vnMonth, targetDay);
  if (!result || result.ms <= 0) {
    const thangSau = vnMonth === 11 ? 0 : vnMonth + 1;
    const namSau   = vnMonth === 11 ? vnYear + 1 : vnYear;
    result = buildTarget(namSau, thangSau, targetDay);
  }
  if (!result || result.ms <= 0) {
    return {
      ms: -1, targetDate: null,
      errorMsg: `Ngày **${targetDay}** không tồn tại trong tháng hiện tại lẫn tháng sau. Hãy kiểm tra lại.`,
    };
  }
  return { ...result, errorMsg: null };
}

function formatThoiGian(ms) {
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 60) return `${totalMin} phút`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h} giờ ${m} phút` : `${h} giờ`;
}

// ─── Tìm kênh thông báo ────────────────────────────────────────
async function timKenhThongBao(guild) {
  if (guild.systemChannelId) {
    const ch = guild.channels.cache.get(guild.systemChannelId);
    if (ch && ch.permissionsFor(guild.members.me)?.has('SendMessages')) return guild.systemChannelId;
  }
  const textCh = guild.channels.cache.find(
    c => c.isTextBased() && !c.isThread() && c.permissionsFor(guild.members.me)?.has('SendMessages'),
  );
  return textCh?.id ?? null;
}

module.exports = { MOC_HUY_HIEU, layHuyHieu, laAdmin, msDenGioVN, formatThoiGian, timKenhThongBao };
