// __mocks__/db.js
// Manual mock — Vitest tự động dùng file này khi gọi vi.mock('../../db.js')
// Dùng CJS (require) để khớp với sourceType của project (không phải ESM module)
'use strict';
const { vi } = require('vitest');

const db = {
  // Guild config
  getGuildConfig:           vi.fn().mockResolvedValue(null),
  upsertGuildConfig:        vi.fn().mockResolvedValue(null),
  setGuildConfig:           vi.fn().mockResolvedValue(null),
  getConfig:                vi.fn().mockResolvedValue(null),

  // Sessions
  createSession:            vi.fn().mockResolvedValue(null),
  getActiveSession:         vi.fn().mockResolvedValue(null),
  getSessionById:           vi.fn().mockResolvedValue(null),
  getSessionByMessageId:    vi.fn().mockResolvedValue(null),
  closeSession:             vi.fn().mockResolvedValue(null),
  cancelSession:            vi.fn().mockResolvedValue(null),
  updateSessionMessage:     vi.fn().mockResolvedValue(null),
  updateSessionName:        vi.fn().mockResolvedValue(null),
  updateSessionEligible:    vi.fn().mockResolvedValue(null),
  getRecentSessions:        vi.fn().mockResolvedValue([]),
  getAllSessions:            vi.fn().mockResolvedValue([]),
  getSessionHistory:        vi.fn().mockResolvedValue([]),

  // Attendances
  upsertAttendance:         vi.fn().mockResolvedValue(null),
  upsertAttendanceNoTime:   vi.fn().mockResolvedValue(null),
  getAttendances:           vi.fn().mockResolvedValue([]),
  getAttendancesByUser:     vi.fn().mockResolvedValue([]),
  getAttendanceStats:       vi.fn().mockResolvedValue([]),

  // Member stats
  getMemberStats:           vi.fn().mockResolvedValue(null),
  getMemberStatsMulti:      vi.fn().mockResolvedValue([]),
  getAllMemberStats:         vi.fn().mockResolvedValue([]),
  upsertMemberStats:        vi.fn().mockResolvedValue(null),
  batchUpsertMemberStats:   vi.fn().mockResolvedValue(null),

  // Badges
  getBadgeDefinitions:      vi.fn().mockResolvedValue([]),
  getUserBadges:            vi.fn().mockResolvedValue([]),
  upsertUserBadge:          vi.fn().mockResolvedValue(null),
  getBadges:                vi.fn().mockResolvedValue([]),
  getMemberBadges:          vi.fn().mockResolvedValue([]),
  upsertMemberBadge:        vi.fn().mockResolvedValue(null),
  getStreak:                vi.fn().mockResolvedValue(null),

  // Members (danh sách thành viên được quản lý)
  getMembers:               vi.fn().mockResolvedValue([]),
  addMember:                vi.fn().mockResolvedValue(null),
  deleteMember:             vi.fn().mockResolvedValue(null),
  resetStreak:              vi.fn().mockResolvedValue(null),
  upsertMember:             vi.fn().mockResolvedValue(null),
  ensureGuildConfig:        vi.fn().mockResolvedValue(null),
  getSessionByIdRaw:        vi.fn().mockResolvedValue(null),
  getTopMembers:            vi.fn().mockResolvedValue([]),
  getServerStats:           vi.fn().mockResolvedValue({ total_sessions: 0, total_members: 0, total_attendances: 0, rate_present: 0 }),
  getAllAttendances:        vi.fn().mockResolvedValue([]),

  // Scheduled sessions
  getScheduledSessions:     vi.fn().mockResolvedValue([]),
  getScheduledSessionById:  vi.fn().mockResolvedValue(null),
  createScheduledSession:   vi.fn().mockResolvedValue(null),
  updateScheduledSession:   vi.fn().mockResolvedValue(null),
  deleteScheduledSession:   vi.fn().mockResolvedValue(null),
  skipScheduledSession:     vi.fn().mockResolvedValue(null),
  getLichCoDinh:            vi.fn().mockResolvedValue([]),
  getLichCoDinhById:        vi.fn().mockResolvedValue(null),
  createLichCoDinh:         vi.fn().mockResolvedValue(null),
  updateLichCoDinh:         vi.fn().mockResolvedValue(null),
  deleteLichCoDinh:         vi.fn().mockResolvedValue(null),
  themLichCoDinh:           vi.fn().mockResolvedValue(null),
  suaLichCoDinh:            vi.fn().mockResolvedValue(null),
  xoaLichCoDinh:            vi.fn().mockResolvedValue(null),
};

module.exports = db;
module.exports.default = db;
// Named exports (spread)
Object.assign(module.exports, db);
