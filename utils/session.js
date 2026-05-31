// utils/session.js — Xử lý kết thúc phiên, huy hiệu, vô hiệu hóa nút
// PERF H-4: batch member stats — O(2N) queries → O(2) queries khi đóng phiên
'use strict';
const db = require('../db.js');
const { buildAttendanceButtons } = require('./embeds.js');
const { MOC_HUY_HIEU } = require('./helpers.js');
const { AttachmentBuilder } = require('discord.js');

// ─── FEAT 3.1: Build CSV buffer từ danh sách điểm danh ───────────────────────
function buildCsvBuffer(session, attended, eligibleMemberIds) {
  const header = 'STT,User ID,Tên,Trạng thái,Thời gian điểm danh';
  const attMap = new Map(attended.map(a => [a.user_id, a]));
  const rows = [];
  let stt = 1;

  for (const a of attended) {
    const trangThai =
      a.status === 'tham_gia' ? 'Tham gia' :
      a.status === 'tre'      ? 'Đến muộn' :
      a.status === 'vang_mat' ? 'Vắng mặt' : a.status;
    const thoiGian = a.checked_in_at
      ? new Date(a.checked_in_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
      : '';
    const ten = (a.username ?? a.user_id).replace(/,/g, ' ');
    rows.push(`${stt++},${a.user_id},${ten},${trangThai},${thoiGian}`);
  }
  for (const uid of eligibleMemberIds) {
    if (!attMap.has(uid)) {
      rows.push(`${stt++},${uid},(chưa điểm danh),Vắng mặt,`);
    }
  }

  const csv = [header, ...rows].join('\n');
  return Buffer.concat([Buffer.from('\xEF\xBB\xBF'), Buffer.from(csv, 'utf8')]);
}

// ─── Kết thúc phiên & cập nhật stats (PERF H-4: batch) ───────────────────────
async function ketThucPhien(guild, session, attended) {
  const eligibleIds = session.eligible_member_ids ?? [];

  // 1 query: lấy toàn bộ stats hiện tại cho guild
  const allStats = await db.getAllMemberStats(guild.id);
  const statsMap = {};
  for (const s of allStats) {
    if (eligibleIds.includes(s.user_id)) {
      statsMap[s.user_id] = {
        total_joined:   s.total_joined   ?? 0,
        current_streak: s.current_streak ?? 0,
      };
    }
  }

  // Tính patch cho mọi eligible member trong memory
  const attSet = new Set(
    attended
      .filter(a => ['tham_gia', 'tre'].includes(a.status))
      .map(a => a.user_id)
  );

  const patches = eligibleIds.map(uid => {
    const prev          = statsMap[uid] ?? { total_joined: 0, current_streak: 0 };
    const thamGia       = attSet.has(uid);
    const total_joined  = prev.total_joined + (thamGia ? 1 : 0);
    const current_streak = thamGia
      ? prev.current_streak + 1
      : 0;
    const max_streak    = Math.max(prev.max_streak ?? 0, current_streak);
    return {
      user_id:        uid,
      total_joined,
      current_streak,
      max_streak,
      last_session_id: session.id,
    };
  });

  // 1 query: bulk upsert tất cả
  await db.batchUpsertMemberStats(guild.id, patches);
  await db.endSession(session.id);

  return statsMap; // trả về snapshot TRƯỚC khi update (dùng cho badge check)
}

// ─── Thông báo huy hiệu mới ───────────────────────────────────────────────────
async function thongBaoHuyHieu(guild, channel, guildId, sessionId, attended, statsMap) {
  const msgs = [];
  // Lấy stats sau update trong 1 query
  const allStatsSau = await db.getAllMemberStats(guildId);
  const statsSauMap = new Map(allStatsSau.map(s => [s.user_id, s]));

  for (const a of attended) {
    if (!['tham_gia', 'tre'].includes(a.status)) continue;
    const statsTruoc = statsMap?.[a.user_id];
    const statsSau   = statsSauMap.get(a.user_id);
    if (!statsSau) continue;
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
    const targetChannel = session.channel_id
      ? await channel.guild.channels.fetch(session.channel_id).catch(() => channel)
      : channel;
    const msgs = await targetChannel.messages.fetch({ limit: 100 }).catch(() => null);
    if (!msgs) return;
    const sessionMsg = msgs.find(m =>
      m.author.id === client.user.id &&
      m.components.length > 0 &&
      m.components[0]?.components[0]?.disabled !== true &&
      m.embeds.some(e => e.title?.includes(session.session_name))
    );
    if (sessionMsg) await sessionMsg.edit({ components: [buildAttendanceButtons(true)] }).catch(() => null);
  } catch (_) {}
}

// ─── FEAT 3.1: Gửi CSV đính kèm sau khi đóng phiên ──────────────────────────
async function guiCsvDiemDanh(channel, session, attended) {
  try {
    const csvBuf  = buildCsvBuffer(session, attended, session.eligible_member_ids ?? []);
    const now     = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
      .replace(/[/:, ]/g, '-').slice(0, 16);
    const fileName = `diemdanh-${session.session_name.replace(/\s+/g, '_')}-${now}.csv`;
    const attachment = new AttachmentBuilder(csvBuf, { name: fileName });
    await channel.send({
      content: `📎 **Xuất danh sách điểm danh** — \`${fileName}\``,
      files: [attachment],
    });
  } catch (e) {
    console.warn('[session] guiCsvDiemDanh lỗi:', e.message);
  }
}

module.exports = { ketThucPhien, thongBaoHuyHieu, voHieuHoaNutDiemDanh, guiCsvDiemDanh, buildCsvBuffer };
