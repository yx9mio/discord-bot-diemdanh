// utils/timers.js — Bộ hẹn giờ tự động đóng phiên (manual /bat_dau)
// FIX:
//   #BUG9 : export alias datHenGioTuDong cho batdau.js (tên cũ không tồn tại → runtime crash)
//   NOTE  : timer này chỉ cho phiên manual; scheduler lịch cố định tự quản timer riêng
const db = require('../db.js');
const { buildSummaryEmbed } = require('./embeds.js');
const { EmbedBuilder } = require('discord.js');
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

// ─── Core: đặt hẹn giờ tự đóng + nhắc nhở ────────────────────
// client, guild (object), session, channelId (string), ms (số ms tới lúc đóng)
async function datHenGioDong(client, guild, session, channelId, ms) {
  xoaHenGio(guild.id);
  const timers = {};

  // ── Nhắc nhở 15 phút trước (chỉ khi phiên > 20 phút) ─────
  if (ms > 20 * 60 * 1000) {
    timers.henGioNhacNho15 = setTimeout(async () => {
      try {
        const ch = await guild.channels.fetch(channelId).catch(() => null);
        const s  = await db.getActiveSession(guild.id);
        if (!s || !ch) return;
        const attended     = await db.getAttendances(s.id);
        const daDiemDanh   = new Set(attended.map(a => a.user_id));
        const chuaDiemDanh = s.eligible_member_ids.filter(id => !daDiemDanh.has(id));
        if (chuaDiemDanh.length === 0) return;
        const embed = new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle('⏰ Nhắc nhở điểm danh — còn 15 phút')
          .setDescription(
            `Phiên **${s.session_name}** sắp đóng.\n\n` +
            chuaDiemDanh.map(id => `<@${id}>`).join(' ')
          )
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
        const attended     = await db.getAttendances(s.id);
        const daDiemDanh   = new Set(attended.map(a => a.user_id));
        const chuaDiemDanh = s.eligible_member_ids.filter(id => !daDiemDanh.has(id));
        if (chuaDiemDanh.length === 0) return;
        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('⏰ Nhắc nhở điểm danh — còn 5 phút!')
          .setDescription(
            `Phiên **${s.session_name}** sắp đóng.\n\n` +
            chuaDiemDanh.map(id => `<@${id}>`).join(' ')
          )
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

// ─── Alias cho batdau.js ───────────────────────────────────────
// BUG#9 FIX: batdau.js gọi datHenGioTuDong(guildId, sessionId, phut, client, channel)
// nhưng file cũ chỉ export datHenGioDong → ReferenceError lúc runtime
async function datHenGioTuDong(guildId, _sessionId, phut, client, channel) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    console.warn('[Quản Gia] datHenGioTuDong: không tìm thấy guild', guildId);
    return;
  }
  const ms = phut * 60 * 1000;
  await datHenGioDong(client, guild, null, channel.id, ms);
}

module.exports = { boHenGio, xoaHenGio, datHenGioDong, datHenGioTuDong };
