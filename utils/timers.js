'use strict';
const { EmbedBuilder } = require('discord.js');
const db  = require('../db.js');
const log = require('./logger.js');
const { ketThucPhien, thongBaoHuyHieu, voHieuHoaNutDiemDanh, guiCsvDinhKem } = require('./session.js');
const { buildSummaryEmbed, FOOTER_DEFAULT, buildSessionEmbed, buildSessionActionRow } = require('./embeds.js');

const timers = new Map(); // guildId → { remind15, remind5, autoClose }
const refreshTimers = new Map(); // sessionId → intervalId

function datHenGioDong(client, guild, session, channelId, ms) {
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

      const ch = await guild.channels.fetch(channelId).catch(() => null);

      try {
        await db.closeSession(session.id);
      } catch (e) {
        log.error('TIMER', guild.id, 'closeSession thất bại %s: %s', session.id, e.message);
        // [#9] Dừng lại khi closeSession lỗi — không tiếp tục xử lý với session chưa đóng được
        return;
      }

      const attended = await db.getAttendances(session.id);
      const statsMap = await ketThucPhien(guild, session, attended);

      if (ch) {
        await voHieuHoaNutDiemDanh(client, ch, session, attended);
        const thongBao = new EmbedBuilder()
          .setColor(0x99AAB5)
          .setDescription('🔒 Phiên điểm danh đã tự động kết thúc.')
          .setFooter({ text: FOOTER_DEFAULT });
        const summaryEmbed = buildSummaryEmbed(session, attended, guild, session.phai_role_ids ?? []);
        await ch.send({ embeds: [thongBao, summaryEmbed] });
        await thongBaoHuyHieu(guild, ch, guild.id, session.id, attended, statsMap);
        await guiCsvDinhKem(ch, session, attended);
      } else {
        log.warn('TIMER', guild.id, 'autoClose: channel %s không tồn tại, bỏ qua gửi embed', channelId);
      }

      stopAutoRefresh(session.id); // [C3]
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

// ─── Auto-refresh embed (C3) ─────────────────────────────────────────────────────
function startAutoRefresh(sessionId, channelId, messageId, client) {
  stopAutoRefresh(sessionId); // Đảm bảo không duplicate

  const intervalId = setInterval(async () => {
    try {
      const session = await db.getSessionById(sessionId);
      if (!session?.is_active || session.id !== sessionId) {
        stopAutoRefresh(sessionId);
        return;
      }

      const attended = await db.getAttendances(sessionId);
      const guild = await client.guilds.fetch(session.guild_id).catch(() => null);
      if (!guild) {
        stopAutoRefresh(sessionId);
        return;
      }

      const { embed } = await buildSessionEmbed(guild, session, attended, session.phai_role_ids ?? []);
      const components = buildSessionActionRow(false);

      const ch = await guild.channels.fetch(channelId).catch(() => null);
      if (!ch) {
        stopAutoRefresh(sessionId);
        return;
      }

      const msg = await ch.messages.fetch(messageId).catch(() => null);
      if (!msg) {
        stopAutoRefresh(sessionId);
        return;
      }

      await msg.edit({ embeds: [embed], components }).catch(() => {
        stopAutoRefresh(sessionId);
      });
    } catch (e) {
      log.error('AUTO_REFRESH', sessionId, 'Lỗi refresh embed: %s', e.message);
      stopAutoRefresh(sessionId);
    }
  }, 60_000); // 60 giây

  refreshTimers.set(sessionId, intervalId);
  log.info('AUTO_REFRESH', sessionId, 'Đã bật auto-refresh mỗi 60s');
}

function stopAutoRefresh(sessionId) {
  const intervalId = refreshTimers.get(sessionId);
  if (!intervalId) return;

  clearInterval(intervalId);
  refreshTimers.delete(sessionId);
  log.info('AUTO_REFRESH', sessionId, 'Đã tắt auto-refresh');
}

function stopAllAutoRefresh() {
  for (const [, intervalId] of refreshTimers) {
    clearInterval(intervalId);
  }
  refreshTimers.clear();
  log.info('AUTO_REFRESH', null, 'Đã tắt tất cả auto-refresh');
}

module.exports = {
  datHenGioDong, huyHenGio, coHenGio, xoaHenGio: huyHenGio,
  startAutoRefresh, stopAutoRefresh, stopAllAutoRefresh, // [BUG-8]
};
