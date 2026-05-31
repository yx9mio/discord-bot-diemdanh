// utils/session.js — Xử lý kết thúc phiên, huy hiệu, vô hiệu hóa nút
const db = require('../db.js');
const { buildAttendanceButtons } = require('./embeds.js');
const { MOC_HUY_HIEU } = require('./helpers.js');

// ─── Kết thúc phiên & cập nhật stats ─────────────────────────
async function ketThucPhien(guild, session, attended) {
  for (const uid of session.eligible_member_ids) {
    // tre (đến trễ) vẫn tính là tham gia cho stats/streak
    const thamGia = attended.some(a => a.user_id === uid && ['tham_gia', 'tre'].includes(a.status));
    await db.updateMemberStats(guild.id, uid, thamGia, session.id);
  }
  await db.endSession(session.id);
}

// ─── Thông báo huy hiệu mới ───────────────────────────────────
async function thongBaoHuyHieu(guild, channel, guildId, sessionId, attended) {
  const msgs = [];
  for (const a of attended) {
    if (!['tham_gia', 'tre'].includes(a.status)) continue;
    const stats = await db.getMemberStats(guildId, a.user_id);
    const truocKhi = stats.total_joined - 1;
    for (const m of MOC_HUY_HIEU) {
      if (truocKhi < m.count && stats.total_joined >= m.count) {
        msgs.push(`🎉 <@${a.user_id}> đạt huy hiệu **${m.badge} ${m.label}** (${m.count} lần tham gia)!`);
      }
    }
  }
  if (msgs.length > 0) await channel.send(msgs.join('\n')).catch(() => null);
}

// ─── Vô hiệu hóa nút điểm danh trên tin nhắn gốc ─────────────
async function voHieuHoaNutDiemDanh(client, channel, session) {
  try {
    if (session.message_id) {
      const msg = await channel.messages.fetch(session.message_id).catch(() => null);
      if (msg) {
        await msg.edit({ components: [buildAttendanceButtons(true)] }).catch(() => null);
        return;
      }
    }
    // Fallback: tìm trong channel gốc
    const targetChannel = session.channel_id
      ? await channel.guild.channels.fetch(session.channel_id).catch(() => channel)
      : channel;
    const msgs = await targetChannel.messages.fetch({ limit: 100 }).catch(() => null);
    if (!msgs) return;
    const sessionMsg = msgs.find(m =>
      m.author.id === client.user.id &&
      m.components.length > 0 &&
      m.embeds[0]?.title?.includes(session.session_name)
    );
    if (sessionMsg) await sessionMsg.edit({ components: [buildAttendanceButtons(true)] }).catch(() => null);
  } catch (_) {}
}

module.exports = { ketThucPhien, thongBaoHuyHieu, voHieuHoaNutDiemDanh };
