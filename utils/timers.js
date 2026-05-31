// utils/timers.js — Bộ hẹn giờ tự động đóng phiên
const db = require('../db.js');
const { buildSummaryEmbed } = require('./embeds.js');
const { EmbedBuilder } = require('discord.js');
const { formatThoiGian, timKenhThongBao } = require('./helpers.js');
const { ketThucPhien, thongBaoHuyHieu, voHieuHoaNutDiemDanh } = require('./session.js');

// ─── Lưu trạng thái hẹn giờ theo guildId ─────────────────────
const boHenGio = new Map();

function xoaHenGio(guildId) {
  const t = boHenGio.get(guildId);
  if (!t) return;
  clearTimeout(t.henGioDong);
  clearTimeout(t.henGioNhacNho15);
  clearTimeout(t.henGioNhacNho5);
  boHenGio.delete(guildId);
}

async function datHenGioDong(client, guild, session, channelId, ms) {
  xoaHenGio(guild.id);
  const timers = {};

  // ── Nhắc nhở 15 phút trước (nếu phiên > 20 phút) ─────────
  if (ms > 20 * 60 * 1000) {
    timers.henGioNhacNho15 = setTimeout(async () => {
      try {
        const ch = await guild.channels.fetch(channelId).catch(() => null);
        const s  = await db.getActiveSession(guild.id);
        if (!s || !ch) return;
        const attended      = await db.getAttendances(s.id);
        const daDiemDanh    = new Set(attended.map(a => a.user_id));
        const chuaDiemDanh  = s.eligible_member_ids.filter(id => !daDiemDanh.has(id));
        if (chuaDiemDanh.length === 0) return;
        const embed = new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle('⏰ Nhắc nhở điểm danh — còn 15 phút')
          .setDescription(`Phiên **${s.session_name}** sắp đóng.\n\n${chuaDiemDanh.map(id => `<@${id}>`).join(' ')}`)
          .setFooter({ text: 'Quản Gia' })
          .setTimestamp();
        await ch.send({ embeds: [embed] });
      } catch (e) { console.error('[Quản Gia] Nhắc 15 phút lỗi:', e.message); }
    }, ms - 15 * 60 * 1000);
  }

  // ── Nhắc nhở 5 phút trước ─────────────────────────────────
  if (ms > 5 * 60 * 1000) {
    timers.henGioNhacNho5 = setTimeout(async () => {
      try {
        const ch = await guild.channels.fetch(channelId).catch(() => null);
        const s  = await db.getActiveSession(guild.id);
        if (!s || !ch) return;
        const attended      = await db.getAttendances(s.id);
        const daDiemDanh    = new Set(attended.map(a => a.user_id));
        const chuaDiemDanh  = s.eligible_member_ids.filter(id => !daDiemDanh.has(id));
        if (chuaDiemDanh.length === 0) return;
        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('⏰ Nhắc nhở điểm danh — còn 5 phút!')
          .setDescription(`Phiên **${s.session_name}** sắp đóng.\n\n${chuaDiemDanh.map(id => `<@${id}>`).join(' ')}`)
          .setFooter({ text: 'Quản Gia' })
          .setTimestamp();
        await ch.send({ embeds: [embed] });
      } catch (e) { console.error('[Quản Gia] Nhắc 5 phút lỗi:', e.message); }
    }, ms - 5 * 60 * 1000);
  }

  // ── Tự đóng phiên ─────────────────────────────────────────
  timers.henGioDong = setTimeout(async () => {
    try {
      const ch = await guild.channels.fetch(channelId).catch(() => null);
      const s  = await db.getActiveSession(guild.id);
      if (!s) return;
      const attended = await db.getAttendances(s.id);
      await ketThucPhien(guild, s, attended);
      xoaHenGio(guild.id);
      if (ch) {
        await voHieuHoaNutDiemDanh(client, ch, s);
        const embed = buildSummaryEmbed(s, attended);
        const thongBao = new EmbedBuilder()
          .setColor(0x99AAB5)
          .setDescription('🔒 Phiên điểm danh đã tự động kết thúc.')
          .setFooter({ text: 'Quản Gia' });
        await ch.send({ embeds: [thongBao, embed] });
        await thongBaoHuyHieu(guild, ch, guild.id, s.id, attended);
      }
    } catch (e) { console.error('[Quản Gia] Tự đóng lỗi:', e.message); }
  }, ms);

  boHenGio.set(guild.id, timers);
}

module.exports = { boHenGio, xoaHenGio, datHenGioDong };
