// utils/embeds.js — Barrel re-export (backward-compatible)
// Tất cả consumer import từ đây như cũ, không cần sửa require path.
'use strict';

// ─── Helpers & constants ──────────────────────────────────────────────────────
const helpers = require('./_helpers');

// ─── Views ────────────────────────────────────────────────────────────────────
const { buildSessionEmbed, buildClosedSessionEmbed } = require('./_views/sessionView');
const { buildAttendConfirmEmbed, buildAdminOverrideSuccessEmbed, buildAttendanceConfirmPrompt, renderAttendancePanel } = require('./_views/attendView');
const { buildRankEmbed }                             = require('./_views/rankView');
const { buildConfigEmbed }                           = require('./_views/configView');
const { buildConfirmRow, buildAttendanceSelectRow, buildAttendanceConfirmRow, buildSessionActionRow, buildBoardRow, buildAdminActionRow, buildAttendanceFilterRow, buildHistoryNavRow } = require('./_views/rows');

module.exports = {
  // Constants
  ...helpers,

  // Views
  buildSessionEmbed,
  buildClosedSessionEmbed,
  buildAttendConfirmEmbed,
  buildAdminOverrideSuccessEmbed,
  buildAttendanceConfirmPrompt,
  renderAttendancePanel,
  buildRankEmbed,
  buildConfigEmbed,

  // Rows
  buildConfirmRow,
  buildAttendanceSelectRow,
  buildAttendanceConfirmRow,
  buildSessionActionRow,
  buildBoardRow,
  buildAdminActionRow,
  buildAttendanceFilterRow,
  buildHistoryNavRow,
};
