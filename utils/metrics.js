// utils/metrics.js — Datadog custom metrics helper
// [Phase C] Wrap dd-trace StatsD để emit custom metrics cho bot.
// Nếu DD_API_KEY không có hoặc dd-trace chưa init → tất cả hàm là no-op.
// Sử dụng: const metrics = require('./utils/metrics');
//           metrics.sessionOpened(guildId);
'use strict';

let _tracer = null;

function _getTracer() {
  if (_tracer !== null) return _tracer;
  // dd-trace đã được init ở index.js trước khi require() module này
  try {
    _tracer = require('dd-trace');
  } catch {
    _tracer = false; // không có module → no-op
  }
  return _tracer;
}

/**
 * Emit increment counter. No-op nếu dd-trace không có.
 * @param {string} metric  — tên metric, vd: 'bot.session.opened'
 * @param {string[]} tags  — vd: ['guild_id:123', 'env:production']
 */
function increment(metric, tags = []) {
  const tracer = _getTracer();
  if (!tracer || !process.env.DD_API_KEY) return;
  try {
    tracer.dogstatsd.increment(metric, 1, tags);
  } catch {
    // graceful fail — không crash bot nếu agent không có
  }
}

/**
 * Emit gauge value. No-op nếu dd-trace không có.
 * @param {string} metric
 * @param {number} value
 * @param {string[]} tags
 */
function gauge(metric, value, tags = []) {
  const tracer = _getTracer();
  if (!tracer || !process.env.DD_API_KEY) return;
  try {
    tracer.dogstatsd.gauge(metric, value, tags);
  } catch {
    // graceful fail
  }
}

// ── Helpers có ngữ nghĩa rõ ràng ─────────────────────────────────────────

/** Session mới được mở (thủ công hoặc scheduler) */
function sessionOpened(guildId, { scheduled = false } = {}) {
  increment('bot.session.opened', [
    `guild_id:${guildId}`,
    `source:${scheduled ? 'scheduler' : 'manual'}`,
  ]);
}

/** Session được đóng */
function sessionClosed(guildId, { cancelled = false } = {}) {
  increment('bot.session.closed', [
    `guild_id:${guildId}`,
    `reason:${cancelled ? 'cancelled' : 'normal'}`,
  ]);
}

/**
 * Điểm danh được ghi nhận
 * @param {string} guildId
 * @param {'tham_gia'|'vang'|'tre'|'phep'} status
 * @param {{ markedBy?: 'self'|'admin' }} opts
 */
function attendanceMarked(guildId, status, { markedBy = 'self' } = {}) {
  increment('bot.attendance.marked', [
    `guild_id:${guildId}`,
    `status:${status}`,
    `marked_by:${markedBy}`,
  ]);
}

/**
 * Slash command được gọi
 * @param {string} commandName  — tên command, vd: 'diemdanh', 'lich'
 * @param {string} guildId
 */
function commandCalled(commandName, guildId) {
  increment('bot.command.called', [
    `command:${commandName}`,
    `guild_id:${guildId}`,
  ]);
}

/**
 * Lỗi command/handler
 * @param {string} commandName
 * @param {string} guildId
 */
function commandError(commandName, guildId) {
  increment('bot.command.error', [
    `command:${commandName}`,
    `guild_id:${guildId}`,
  ]);
}

/**
 * Số member active trong một session
 * @param {string} guildId
 * @param {number} count
 */
function sessionMemberCount(guildId, count) {
  gauge('bot.session.member_count', count, [`guild_id:${guildId}`]);
}

module.exports = {
  increment,
  gauge,
  sessionOpened,
  sessionClosed,
  attendanceMarked,
  commandCalled,
  commandError,
  sessionMemberCount,
};
