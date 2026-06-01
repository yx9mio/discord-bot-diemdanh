'use strict';
const { EmbedBuilder } = require('discord.js');
const db  = require('../db.js');
const log = require('./logger.js');
const { ketThucPhien, thongBaoHuyHieu, voHieuHoaNutDiemDanh, guiCsvDinhKem } = require('./session.js');
const { buildSummaryEmbed, FOOTER_DEFAULT } = require('./embeds.js');

const timers = new Map(); // guildId → { remind15, remind5, autoClose }

async function datHenGioDong(client, guild, session, channelId, ms) {
  huyHenGio(guild.id);

  const t = {};

  // ── 15 phút ──────────────────────────────────────────────────────────────
  const ms15 = ms - 15 * 60_000;
  if (ms15 > 0) {
    t.remind15 = setTimeout(async () => {
      try {
        const ch = await guild.channels.fetch(channelId).catch(() => null);
        if (!ch) return;
        const cur = await db.getActiveSession(guild.id);
        if (!cur || cur.id !== session.id) return;
        await ch.send({ embeds: [
          new EmbedBuilder()
            .setColor(0xF1C40F)
            .setDescription('⏰ **Còn 15 phút** — Phiên điểm danh sắp kết thúc!')
            .setFooter({ text: FOOTER_DEFAULT }),
        ] });
      } catch (e) { log.error('TIMER', guild.id, 'Nhắc 15 phút lỗi: %s', e.message); }
    }, ms15);
  }

  // ── 5 phút ───────────────────────────────────────────────────────────────
  const ms5 = ms - 5 * 60_000;
  if (ms5 > 0) {
    t.remind5 = setTimeout(async () => {
      try {
        const ch = await guild.channels.fetch(channelId).catch(() => null);
        if (!ch) return;
        const cur = await db.getActiveSession(guild.id);
        if (!cur || cur.id !== session.id) return;
        await ch.send({ embeds: [
          new EmbedBuilder()
            .setColor(0xE67E22)
            .setDescription('⏰ **Còn 5 phút** — Điểm danh ngay nếu chưa!')
            .setFooter({ text: FOOTER_DEFAULT }),
        ] });
      } catch (e) { log.error('TIMER', guild.id, 'Nhắc 5 phút lỗi: %s', e.message); }
    }, ms5);
  }

  // ── Tự đóng ──────────────────────────────────────────────────────────────
  t.autoClose = setTimeout(async () => {
    try {
      const cur = await db.getActiveSession(guild.id);
      if (!cur || cur.id !== session.id) return;

      // BUG-9 fix: fetch channel trước, nếu null thì vẫn đóng DB nhưng không gửi embed
      const ch = await guild.channels.fetch(channelId).catch(() => null);

      try {
        await db.closeSession(session.id);
      } catch (e) {
        log.error('TIMER', guild.id, 'closeSession thất bại %s: %s', session.id, e.message);
        // Không return — tiếp tục dọn dẹp bộ nhớ dù DB fail
      }

      const attended = await db.getAttendances(session.id);
      const statsMap = await ketThucPhien(guild, session, attended);

      if (ch) {
        await voHieuHoaNutDiemDanh(client, ch, session, attended);
        const thongBao = new EmbedBuilder()
          .setColor(0x99AAB5)
          .setDescription('🔒 Phiên điểm danh đã tự động kết thúc.')
          .setFooter({ text: FOOTER_DEFAULT });
        const summaryEmbed = buildSummaryEmbed(session, attended, guild);
        await ch.send({ embeds: [thongBao, summaryEmbed] });
        await thongBaoHuyHieu(guild, ch, guild.id, session.id, attended, statsMap);
        await guiCsvDinhKem(ch, session, attended);
      } else {
        log.warn('TIMER', guild.id, 'autoClose: channel %s không tồn tại, bỏ qua gửi embed', channelId);
      }

      timers.delete(guild.id);
    } catch (e) { log.error('TIMER', guild.id, 'Tự đóng lỗi: %s', e.message); }
  }, ms);

  timers.set(guild.id, t);
}

function huyHenGio(guildId) {
  const t = timers.get(guildId);
  if (!t) return;
  clearTimeout(t.remind15);
  clearTimeout(t.remind5);
  clearTimeout(t.autoClose);
  timers.delete(guildId);
}

function coHenGio(guildId) {
  return timers.has(guildId);
}

module.exports = { datHenGioDong, huyHenGio, coHenGio, xoaHenGio: huyHenGio };
