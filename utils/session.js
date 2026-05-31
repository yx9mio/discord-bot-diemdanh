// utils/session.js — Xử lý kết thúc phiên, huy hiệu, vô hiệu hóa nút
// FEAT 3.1: Export CSV sau khi đóng phiên
const db = require('../db.js');
const { buildAttendanceButtons } = require('./embeds.js');
const { MOC_HUY_HIEU } = require('./helpers.js');
const { AttachmentBuilder } = require('discord.js');

// ─── FEAT 3.1: Build CSV buffer từ danh sách điểm danh ───────────────────────
// Trả về Buffer UTF-8 BOM để Excel mở đúng tiếng Việt
function buildCsvBuffer(session, attended, eligibleMemberIds) {
  const header = 'STT,User ID,Tên,Trạng thái,Thời gian điểm danh';
  const attMap = new Map(attended.map(a => [a.user_id, a]));

  const rows = [];
  let stt = 1;

  // Thành viên có điểm danh
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

  // Thành viên vắng (eligible nhưng không có record)
  for (const uid of eligibleMemberIds) {
    if (!attMap.has(uid)) {
      rows.push(`${stt++},${uid},(chưa điểm danh),Vắng mặt,`);
    }
  }

  const csv = [header, ...rows].join('\n');
  // BOM UTF-8 để Excel nhận dạng đúng
  return Buffer.concat([Buffer.from('\xEF\xBB\xBF'), Buffer.from(csv, 'utf8')]);
}

// ─── Kết thúc phiên & cập nhật stats ─────────────────────────────────────────
async function ketThucPhien(guild, session, attended) {
  const statsMap = {};
  for (const uid of session.eligible_member_ids) {
    const s = await db.getMemberStats(guild.id, uid).catch(() => null);
    if (s) statsMap[uid] = { total_joined: s.total_joined, current_streak: s.current_streak };
  }

  for (const uid of session.eligible_member_ids) {
    const thamGia = attended.some(a => a.user_id === uid && ['tham_gia', 'tre'].includes(a.status));
    await db.updateMemberStats(guild.id, uid, thamGia, session.id);
  }

  await db.endSession(session.id);
  return statsMap;
}

// ─── Thông báo huy hiệu mới ───────────────────────────────────────────────────
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
// Gọi sau buildSummaryEmbed / gửi embed tổng kết
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
