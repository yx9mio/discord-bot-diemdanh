// utils/scheduler.js
'use strict';
const { EmbedBuilder } = require('discord.js');
const sessionService   = require('../services/sessionService.js');
const attendanceService = require('../services/attendanceService.js');
const memberService    = require('../services/memberService.js');
const configService    = require('../services/configService.js');
const { buildSummaryEmbed, buildClosedSessionEmbed, buildSessionActionRow } = require('./embeds.js');
const { ketThucPhien }  = require('./session.js');
const { metrics }       = require('./metrics.js');
const log               = require('./logger.js');

// ── Auto-refresh map: sessionId → intervalId ───────────────────────────────
const _refreshMap = new Map();

// eslint-disable-next-line require-await
function startAutoRefresh(sessionId, fn, intervalMs = 30_000) {
  stopAutoRefresh(sessionId);
  const id = setInterval(fn, intervalMs);
  _refreshMap.set(sessionId, id);
  return id;
}

function stopAutoRefresh(sessionId) {
  const id = _refreshMap.get(sessionId);
  if (id != null) { clearInterval(id); _refreshMap.delete(sessionId); }
}

// ── Hẹn giờ đóng phiên: guildId → timeoutId ───────────────────────────────
const _timers = new Map();

function datHenGio(guildId, fn, delayMs) {
  xoaHenGio(guildId);
  const id = setTimeout(fn, delayMs);
  _timers.set(guildId, id);
  return id;
}

function xoaHenGio(guildId) {
  const id = _timers.get(guildId);
  if (id != null) { clearTimeout(id); _timers.delete(guildId); }
}

// ── CSV đính kèm khi kết thúc phiên ────────────────────────────────────────
async function guiCsvDinhKem(ch, session, attended) {
  if (!attended.length) return;
  const { buildCSVBuffer } = require('./csvExport.js');
  const buf = buildCSVBuffer(attended);
  await ch.send({
    content: `📎 CSV điểm danh — **${session.session_name}**`,
    files: [{ attachment: buf, name: `diemdanh_${session.id}.csv` }],
  });
}

// ── Thông báo huy hiệu đạt được ─────────────────────────────────────────────
async function thongBaoHuyHieu(guild, ch, guildId, sessionId, attended, statsMap) {
  const badges = await memberService.getBadges(guildId).catch(() => []);
  if (!badges.length) return;

  const earnedSet = new Set(badges.map(b => b.threshold).filter(t => t != null));

  const msgs = [];
  for (const record of attended) {
    const s = statsMap?.get(record.user_id);
    if (!s || !earnedSet.has(s.total)) continue;
    const badge = badges.find(b => b.threshold === s.total);
    if (badge) msgs.push(`🎖️ <@${record.user_id}> đã đạt huy hiệu **${badge.label}** ${badge.emoji} (${s.total} buổi)`);
  }

  if (msgs.length) await ch.send({ content: msgs.join('\n') }).catch(() => null);
}

// ── Mở phiên mới và gửi embed ─────────────────────────────────────────────
async function moPhienMoi(guild, ch, sessionData) {
  const { buildSessionEmbed } = require('./embeds.js');

  const session    = await sessionService.createSession({ ...sessionData, guild_id: guild.id });
  const attendances = [];
  const embed      = await buildSessionEmbed(session, attendances, guild);
  const buttons    = buildSessionActionRow(true);

  const pingContent = sessionData.pingRoleIds?.length
    ? sessionData.pingRoleIds.map(id => `<@&${id}>`).join(' ')
    : null;

  const msg = await ch.send({ content: pingContent, embeds: [embed], components: buttons });

  await sessionService.updateSessionMessage(session.id, msg.id);

  // Auto-close theo duration nếu có
  if (session.duration_minutes) {
    const delayMs = session.duration_minutes * 60 * 1000;
    datHenGio(guild.id, () => dongPhienTuDong(guild, session.id, ch, { silent: false }), delayMs);
    log.info('SCHEDULER', guild.id, 'Hẹn giờ đóng phiên %s sau %dm', session.id, session.duration_minutes);
  }

  return { session, msg };
}

// ── Đóng phiên (auto hoặc manual) ─────────────────────────────────────────
async function dongPhienTuDong(guild, sessionId, ch, { silent = false } = {}) {
  const session = await sessionService.getSessionById(sessionId).catch(() => null);
  if (!session || session.status !== 'open') {
    log.warn('SCHEDULER', guild.id, 'dongPhienTuDong: phiên %s không tồn tại hoặc không mở', sessionId);
    return;
  }

  stopAutoRefresh(session.id);
  xoaHenGio(guild.id);

  const attended = await attendanceService.getAttendances(session.id);
  const statsMap = await ketThucPhien(guild, session, attended).catch(e => {
    log.error('SCHEDULER', guild.id, 'ketThucPhien thất bại %s: %s', session.id, e.message);
    return new Map();
  });

  try {
    await sessionService.closeSession(session.id);
  } catch (e) {
    log.error('SCHEDULER', guild.id, 'closeSession thất bại %s: %s', session.id, e.message);
  }

  // [Phase C] Metrics: session đóng + số lượng member
  metrics.sessionClosed(guild.id, { cancelled: false });
  metrics.sessionMemberCount(guild.id, attended.length);

  try {
    if (session.message_id) {
      const msg = await ch.messages.fetch(session.message_id).catch(() => null);
      if (msg) {
        const closedEmbed  = await buildClosedSessionEmbed(session, attended, guild);
        const disabledBtns = buildSessionActionRow(false); // [BUG-FIX] false=closed → disable all buttons
        await msg.edit({ embeds: [closedEmbed], components: disabledBtns }).catch(() => null);
      }
    }
  } catch (_e) {}

  if (!silent) {
    const summaryEmbed = buildSummaryEmbed(session, attended, guild, session.phai_role_ids ?? []);
    await Promise.all([
      ch.send({ embeds: [summaryEmbed] }),
      guiCsvDinhKem(ch, session, attended).catch(_e => {}),
      thongBaoHuyHieu(guild, ch, guild.id, session.id, attended, statsMap).catch(_e => {}),
    ]);
  }

  log.info('SCHEDULER', guild.id, '%s — đã đóng%s: %s', guild.name, silent ? ' (silent)' : '', session.session_name);
}

// ── Khởi động lại hẹn giờ khi bot restart ──────────────────────────────────
async function khoiPhucHenGio(client) {
  const guilds = client.guilds.cache.values();
  for (const guild of guilds) {
    try {
      const session = await sessionService.getActiveSession(guild.id);
      if (!session || !session.duration_minutes) continue;

      const cfg = await configService.getGuildConfig(guild.id).catch(() => null);
      if (!cfg?.log_channel_id) continue;
      const ch = guild.channels.cache.get(cfg.log_channel_id);
      if (!ch) continue;

      const openedAt  = new Date(session.opened_at).getTime();
      const closeAt   = openedAt + session.duration_minutes * 60 * 1000;
      const remaining = closeAt - Date.now();

      if (remaining <= 0) {
        // Đã quá giờ → đóng ngay
        await dongPhienTuDong(guild, session.id, ch, { silent: true });
      } else {
        datHenGio(guild.id, () => dongPhienTuDong(guild, session.id, ch, { silent: false }), remaining);
        log.info('SCHEDULER', guild.id, 'Khôi phục hẹn giờ %s: còn %ds', session.id, Math.round(remaining / 1000));
      }
    } catch (e) {
      log.error('SCHEDULER', guild.id, 'khoiPhucHenGio lỗi: %s', e.message);
    }
  }
}

module.exports = {
  startAutoRefresh,
  stopAutoRefresh,
  datHenGio,
  xoaHenGio,
  moPhienMoi,
  dongPhienTuDong,
  khoiPhucHenGio,
};
