// utils/session.js — Xử lý kết thúc phiên, huy hiệu, vô hiệu hóa nút
const db = require('../db.js');
const { buildAttendanceButtons } = require('./embeds.js');
const { MOC_HUY_HIEU } = require('./helpers.js');

// ─── Kết thúc phiên & cập nhật stats ─────────────────────────────────────────
// Trả về statsMap (snapshot TRƯỚC khi update) để caller dùng cho thongBaoHuyHieu
async function ketThucPhien(guild, session, attended) {
  // 1. Snapshot stats TRƯỚC khi update
  const statsMap = {};
  for (const uid of session.eligible_member_ids) {
    const s = await db.getMemberStats(guild.id, uid).catch(() => null);
    if (s) statsMap[uid] = { total_joined: s.total_joined, current_streak: s.current_streak };
  }

  // 2. Cập nhật stats
  for (const uid of session.eligible_member_ids) {
    const thamGia = attended.some(a => a.user_id === uid && ['tham_gia', 'tre'].includes(a.status));
    await db.updateMemberStats(guild.id, uid, thamGia, session.id);
  }

  // 3. Đóng phiên
  await db.endSession(session.id);

  return statsMap;
}

// ─── Thông báo huy hiệu mới ───────────────────────────────────────────────────
// statsMap: snapshot TRƯỚC khi update (từ ketThucPhien)
async function thongBaoHuyHieu(guild, channel, guildId, sessionId, attended, statsMap) {
  const msgs = [];
  for (const a of attended) {
    if (!['tham_gia', 'tre'].includes(a.status)) continue;

    const statsTruoc = statsMap?.[a.user_id];
    const statsSau   = await db.getMemberStats(guildId, a.user_id);

    const truocKhi = statsTruoc != null ? statsTruoc.total_joined : Math.max(0, statsSau.total_joined - 1);
    const sauKhi   = statsSau.total_joined;

    for (const m of MOC_HUY_HIEU) {
      if (truocKhi < m.count && sauKhi >= m.count) {
        msgs.push(`🎉 <@${a.user_id}> đạt huy hiệu **${m.badge} ${m.label}** (${m.count} lần tham gia)!`);
      }
    }
  }
  if (msgs.length > 0) await channel.send(msgs.join('\n')).catch(() => null);
}

// ─── Vô hiệu hóa nút điểm danh trên tin nhắn gốc ────────────────────────────
async function voHieuHoaNutDiemDanh(client, channel, session) {
  try {
    if (session.message_id) {
      const targetCh = session.channel_id
        ? await channel.guild.channels.fetch(session.channel_id).catch(() => channel)
        : channel;
      const msg = await targetCh.messages.fetch(session.message_id).catch(() => null);
      if (msg) {
        await msg.edit({ components: [buildAttendanceButtons(true)] }).catch(() => null);
        return;
      }
    }
    // Fallback: tìm trong 100 message gần nhất
    const targetChannel = session.channel_id
      ? await channel.guild.channels.fetch(session.channel_id).catch(() => channel)
      : channel;
    const msgs = await targetChannel.messages.fetch({ limit: 100 }).catch(() => null);
    if (!msgs) return;
    const sessionMsg = msgs.find(m =>
      m.author.id === client.user.id &&
      m.components.length > 0 &&
      m.embeds.some(e => e.title?.includes(session.session_name))
    );
    if (sessionMsg) await sessionMsg.edit({ components: [buildAttendanceButtons(true)] }).catch(() => null);
  } catch (_) {}
}

module.exports = { ketThucPhien, thongBaoHuyHieu, voHieuHoaNutDiemDanh };
