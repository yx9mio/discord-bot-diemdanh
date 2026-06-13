'use strict';
const { EmbedBuilder } = require('discord.js');
const sessionService    = require('../services/sessionService.js');
const attendanceService = require('../services/attendanceService.js');
const configService     = require('../services/configService.js');
const log = require('./logger.js');
const { endSession, announceBadges, disableAttendanceUI } = require('./session.js');
const {
  buildSummaryEmbed, FOOTER_DEFAULT, buildSessionEmbed,
  buildSessionActionRow, buildAttendanceSelectRow,
} = require('./embeds.js');

// timers: Map<sessionId, { remind15, remind5, autoClose, guildId }>
const timers = new Map();
const refreshTimers = new Map(); // sessionId → intervalId

function scheduleCloseTimer(client, guild, session, channelId, ms) {
  // Hủy timer cũ cho session này nếu có
  cancelSessionTimer(session.id);

  const t = { guildId: guild.id };

  const ms15 = ms - 15 * 60_000;
  if (ms15 > 0) {
    t.remind15 = setTimeout(async () => {
      try {
        const ch = await guild.channels.fetch(channelId).catch(() => null);
        if (!ch) return;
        const cur = await sessionService.getSessionById(session.id);
        if (!cur?.is_active || cur.id !== session.id) return;
        await ch.send({ embeds: [
          new EmbedBuilder()
            .setColor(0xF1C40F)
            .setDescription('⏰ **Còn 15 phút** — Phiên điểm danh sắp kết thúc!')
            .setFooter({ text: FOOTER_DEFAULT }),
        ] });
      } catch (e) { log.error('TIMER', guild.id, 'Nhắc 15 phút lỗi: %s', e.message); }
    }, ms15);
  }

  const ms5 = ms - 5 * 60_000;
  if (ms5 > 0) {
    t.remind5 = setTimeout(async () => {
      try {
        const ch = await guild.channels.fetch(channelId).catch(() => null);
        if (!ch) return;
        const cur = await sessionService.getSessionById(session.id);
        if (!cur?.is_active || cur.id !== session.id) return;
        await ch.send({ embeds: [
          new EmbedBuilder()
            .setColor(0xE67E22)
            .setDescription('⏰ **Còn 5 phút** — Điểm danh ngay nếu chưa!')
            .setFooter({ text: FOOTER_DEFAULT }),
        ] });
      } catch (e) { log.error('TIMER', guild.id, 'Nhắc 5 phút lỗi: %s', e.message); }
    }, ms5);
  }

  t.autoClose = setTimeout(async () => {
    try {
      const cur = await sessionService.getSessionById(session.id);
      if (!cur?.is_active || cur.id !== session.id) return;

      const ch = await guild.channels.fetch(channelId).catch(() => null);

      try {
        await sessionService.closeSession(session.id, guild.id);
      } catch (e) {
        log.error('TIMER', guild.id, 'closeSession thất bại %s: %s', session.id, e.message);
        return;
      }

      const attended = await attendanceService.getAttendances(session.id);
      const statsMap = await endSession(guild, session, attended);

      if (ch) {
        await disableAttendanceUI(client, ch, session, attended);
        const msg = new EmbedBuilder()
          .setColor(0x99AAB5)
          .setDescription('🔒 Phiên điểm danh đã tự động kết thúc.')
          .setFooter({ text: FOOTER_DEFAULT });
        const cfgT1 = await configService.getGuildConfig(guild.id).catch(() => null);
        const phaiIds4 = session.phai_role_ids?.length
          ? session.phai_role_ids
          : cfgT1?.phai_role_ids ?? [];
        const summaryEmbed = await buildSummaryEmbed(session, attended, guild, phaiIds4, cfgT1?.phai_role_icons ?? null);
        await ch.send({ embeds: [msg, summaryEmbed] });
        await announceBadges(guild, ch, guild.id, session.id, attended, statsMap);
      } else {
        log.warn('TIMER', guild.id, 'autoClose: channel %s không tồn tại, bỏ qua gửi embed', channelId);
      }

      stopAutoRefresh(session.id);
      cancelSessionTimer(session.id);
    } catch (e) { log.error('TIMER', guild.id, 'Tự đóng lỗi: %s', e.message); }
  }, ms);

  timers.set(session.id, t);
}

function cancelSessionTimer(sessionId) {
  const t = timers.get(sessionId);
  if (!t) return;
  clearTimeout(t.remind15);
  clearTimeout(t.remind5);
  clearTimeout(t.autoClose);
  timers.delete(sessionId);
}

function cancelTimers(guildId) {
  for (const [sessionId, t] of timers) {
    if (t.guildId === guildId) {
      clearTimeout(t.remind15);
      clearTimeout(t.remind5);
      clearTimeout(t.autoClose);
      timers.delete(sessionId);
      stopAutoRefresh(sessionId);
    }
  }
}

const huyHenGio = cancelTimers;

function hasTimers(guildId) {
  for (const t of timers.values()) {
    if (t.guildId === guildId) return true;
  }
  return false;
}

const coHenGio = hasTimers;

// ─── Auto-refresh embed ─────────────────────────────────────────

function startAutoRefresh(sessionId, channelId, messageId, client) {
  stopAutoRefresh(sessionId);

  const intervalId = setInterval(async () => {
    try {
      const session = await sessionService.getSessionById(sessionId);
      if (!session?.is_active || session.id !== sessionId) {
        stopAutoRefresh(sessionId);
        return;
      }

      const attended = await attendanceService.getAttendances(sessionId);
      const guild = await client.guilds.fetch(session.guild_id).catch(() => null);
      if (!guild) {
        stopAutoRefresh(sessionId);
        return;
      }

      const cfgT2 = await configService.getGuildConfig(guild.id).catch(() => null);
      const phaiIds5 = session.phai_role_ids?.length
        ? session.phai_role_ids
        : cfgT2?.phai_role_ids ?? [];
      const { embed, components: pagComponents } = buildSessionEmbed(guild, session, attended, phaiIds5, false, 1, cfgT2?.phai_role_icons ?? null);
      const selectRow = buildAttendanceSelectRow(true);
      const adminRows = buildSessionActionRow(true);
      const components = [selectRow, ...adminRows, ...pagComponents].slice(0, 5);

      const ch = await guild.channels.fetch(channelId).catch(() => null);
      if (!ch) { stopAutoRefresh(sessionId); return; }

      const msg = await ch.messages.fetch(messageId).catch(() => null);
      if (!msg) { stopAutoRefresh(sessionId); return; }

      await msg.edit({ embeds: [embed], components }).catch(() => {
        stopAutoRefresh(sessionId);
      });
    } catch (e) {
      log.error('AUTO_REFRESH', sessionId, 'Lỗi refresh embed: %s', e.message);
      stopAutoRefresh(sessionId);
    }
  }, 60_000);

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
  scheduleCloseTimer, datHenGioDong: scheduleCloseTimer,
  cancelTimers, huyHenGio, coHenGio, xoaHenGio: cancelTimers, hasTimers,
  cancelSessionTimer,
  startAutoRefresh, stopAutoRefresh, stopAllAutoRefresh,
};
