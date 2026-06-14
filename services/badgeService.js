'use strict';

const DEFAULT_BADGES = [
  { threshold:   5, emoji: '🌱', label: 'Lính Mới'     },
  { threshold:  10, emoji: '⭐', label: 'Cần Cù'        },
  { threshold:  20, emoji: '🌟', label: 'Chuyên Cần'    },
  { threshold:  30, emoji: '💪', label: 'Kiên Trì'      },
  { threshold:  50, emoji: '🏆', label: 'Huyền Thoại'   },
  { threshold: 100, emoji: '👑', label: 'Vua Điểm Danh' },
];

let _memberService = null;
let _log = null;

function _ms() {
  if (!_memberService) _memberService = require('./memberService.js');
  return _memberService;
}

function _logger() {
  if (!_log) _log = require('../utils/logger.js');
  return _log;
}

async function getAvailableBadges(guildId) {
  try {
    const rows = await _ms().getBadgeDefinitions(guildId);
    return rows.length ? rows : DEFAULT_BADGES;
  } catch {
    return DEFAULT_BADGES;
  }
}

async function getBadgesForUser(guildId, userId) {
  return _ms().getMemberBadges(guildId, userId);
}

async function checkAndAwardBadges(guildId, userId, totalJoined) {
  const badges = await getAvailableBadges(guildId);
  if (!badges.length) return [];

  const existing = await _ms().getMemberBadges(guildId, userId);
  const earnedSet = new Set(existing.map(b => b.threshold).filter(t => t != null));

  const awarded = [];
  for (const badge of badges) {
    if (badge.threshold == null) continue;
    if (totalJoined >= badge.threshold && !earnedSet.has(badge.threshold)) {
      try {
        await _ms().upsertMemberBadge(guildId, userId, badge.threshold);
        awarded.push(badge);
      } catch (e) {
        _logger().warn('BADGE_SVC', guildId, 'award fail uid=%s th=%d: %s', userId, badge.threshold, e.message);
      }
    }
  }
  return awarded;
}

async function checkAndAwardBadgesBatch(guildId, userStatsMap) {
  if (!userStatsMap || !(userStatsMap instanceof Map) || !userStatsMap.size) return [];

  const badges = await getAvailableBadges(guildId);
  if (!badges.length) return [];

  const userIds = Array.from(userStatsMap.keys());
  const allUserBadges = await _ms().getMemberBadgesMulti(guildId, userIds);

  const allAwarded = [];
  for (const [userId, stats] of userStatsMap.entries()) {
    const existing = allUserBadges[userId] ?? [];
    const earnedSet = new Set(existing.map(b => b.threshold).filter(t => t != null));

    for (const badge of badges) {
      if (badge.threshold == null) continue;
      if (stats.total >= badge.threshold && !earnedSet.has(badge.threshold)) {
        try {
          await _ms().upsertMemberBadge(guildId, userId, badge.threshold);
          allAwarded.push({ userId, badge });
        } catch (e) {
          _logger().warn('BADGE_SVC', guildId, 'batch award fail uid=%s th=%d: %s', userId, badge.threshold, e.message);
        }
      }
    }
  }
  return allAwarded;
}

module.exports = {
  getAvailableBadges,
  getBadgesForUser,
  checkAndAwardBadges,
  checkAndAwardBadgesBatch,
};
