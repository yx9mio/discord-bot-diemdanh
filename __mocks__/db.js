// __mocks__/db.js
// Manual mock — Vitest/Jest tự động dùng file này khi gọi vi.mock('../../db.js')
// Không có kết nối Supabase thật, mọi hàm trả về resolved Promise mặc định.
import { vi } from 'vitest';

const db = {
  // Guild config
  getGuildConfig:           vi.fn().mockResolvedValue(null),
  upsertGuildConfig:        vi.fn().mockResolvedValue(null),
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

export default db;
export const {
  getGuildConfig, upsertGuildConfig, getConfig,
  createSession, getActiveSession, getSessionById, getSessionByMessageId,
  closeSession, cancelSession,
  updateSessionMessage, updateSessionName, updateSessionEligible,
  getRecentSessions, getAllSessions, getSessionHistory,
  upsertAttendance, upsertAttendanceNoTime,
  getAttendances, getAttendancesByUser, getAttendanceStats,
  getMemberStats, getMemberStatsMulti, getAllMemberStats,
  upsertMemberStats, batchUpsertMemberStats,
  getBadgeDefinitions, getUserBadges, upsertUserBadge,
  getBadges, getMemberBadges, upsertMemberBadge, getStreak,
  getScheduledSessions, getScheduledSessionById,
  createScheduledSession, updateScheduledSession,
  deleteScheduledSession, skipScheduledSession,
  getLichCoDinh, getLichCoDinhById,
  createLichCoDinh, updateLichCoDinh, deleteLichCoDinh,
  themLichCoDinh, suaLichCoDinh, xoaLichCoDinh,
} = db;
