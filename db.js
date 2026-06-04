// db.js — Re-export adapter (Phase B-2)
// [#3] Không còn chứa logic. Mọi implementation đã chuyển vào services/.
// File này giữ nguyên để backward-compatible với callers dùng require('./db').
// Phase B-3: migrate callers import trực tiếp từ service.
// Phase B-4: xóa file này.
'use strict';

const sessionService   = require('./services/sessionService');
const attendanceSvc    = require('./services/attendanceService');
const memberService    = require('./services/memberService');
const configService    = require('./services/configService');
const scheduledService = require('./services/scheduledService');

module.exports = {
  // ─── Config ────────────────────────────────────────────────────────────
  ...configService,

  // ─── Session ───────────────────────────────────────────────────────────
  ...sessionService,

  // ─── Attendance ────────────────────────────────────────────────────────
  ...attendanceSvc,

  // ─── Member / Stats / Badges ───────────────────────────────────────────
  ...memberService,

  // ─── Scheduled (lịch cố định) ──────────────────────────────────────────
  ...scheduledService,
};
