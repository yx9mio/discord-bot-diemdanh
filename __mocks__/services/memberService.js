// __mocks__/services/memberService.js
// [B-4a] Manual mock cho memberService — dùng khi vi.mock('../../services/memberService')
'use strict';
const { vi } = require('vitest');

module.exports = {
  getMemberStats:        vi.fn().mockResolvedValue({ current_streak: 0, best_streak: 0, total_joined: 0 }),
  getMemberStatsMulti:   vi.fn().mockResolvedValue([]),
  getAllMemberStats:      vi.fn().mockResolvedValue([]),
  upsertMemberStats:     vi.fn().mockResolvedValue(null),
  batchUpsertMemberStats: vi.fn().mockResolvedValue(null),
  getBadgeDefinitions:   vi.fn().mockResolvedValue([]),
  getUserBadges:         vi.fn().mockResolvedValue([]),
  upsertUserBadge:       vi.fn().mockResolvedValue(null),
  getBadges:             vi.fn().mockResolvedValue([]),
  getMemberBadges:       vi.fn().mockResolvedValue([]),
  upsertMemberBadge:     vi.fn().mockResolvedValue(null),
  getMemberBadgesMulti:  vi.fn().mockResolvedValue({}),
  batchUpsertUserBadges: vi.fn().mockResolvedValue(null),
  getMembers:            vi.fn().mockResolvedValue([]),
  addMember:             vi.fn().mockResolvedValue(null),
  deleteMember:          vi.fn().mockResolvedValue(null),
  resetStreak:           vi.fn().mockResolvedValue(null),
  upsertMember:          vi.fn().mockResolvedValue(null),
  ensureGuildConfig:     vi.fn().mockResolvedValue(null),
  getTopMembers:         vi.fn().mockResolvedValue([]),
  getServerStats:        vi.fn().mockResolvedValue({ total_sessions: 0, total_members: 0, total_attendances: 0, rate_present: 0 }),
};
