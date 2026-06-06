// utils/commands.js
// Metadata trung tâm cho tất cả slash commands — dùng bởi /help.
'use strict';

export const CATEGORIES = {
  session:  { emoji: '📋', label: 'Quản lý phiên' },
  stats:    { emoji: '📊', label: 'Thống kê' },
  admin:    { emoji: '🛡️', label: 'Quản trị' },
  general:  { emoji: 'ℹ️', label: 'Chung' },
};

// audience: 'user' | 'admin' | 'both'
export const COMMAND_REGISTRY = [
  // ─── Session ────────────────────────────────────────────────────────────────
  {
    name: 'start',
    desc: 'Mở phiên điểm danh mới',
    category: 'session',
    audience: 'admin',
    examples: ['/start tên:Họp tuần'],
  },
  {
    name: 'close',
    desc: 'Đóng phiên điểm danh đang mở',
    category: 'session',
    audience: 'admin',
  },
  {
    name: 'cancel',
    desc: 'Hủy phiên điểm danh đang mở',
    category: 'session',
    audience: 'admin',
  },
  {
    name: 'status',
    desc: 'Xem trạng thái phiên hiện tại',
    category: 'session',
    audience: 'both',
    examples: ['/status'],
  },

  // ─── Stats ──────────────────────────────────────────────────────────────────
  {
    name: 'mystats',
    desc: 'Xem thống kê điểm danh của bạn',
    category: 'stats',
    audience: 'user',
    examples: ['/mystats'],
  },
  {
    name: 'stats',
    desc: 'Xem thống kê điểm danh của một thành viên',
    category: 'stats',
    audience: 'admin',
    examples: ['/stats user:@user'],
  },
  {
    name: 'leaderboard',
    desc: 'Bảng xếp hạng điểm danh',
    category: 'stats',
    audience: 'both',
    examples: ['/leaderboard'],
  },
  {
    name: 'inactive',
    desc: 'Danh sách thành viên vắng nhiều nhất',
    category: 'stats',
    audience: 'admin',
    examples: ['/inactive nguong:60', '/inactive nguong:50 so_phien_toi_thieu:5'],
  },

  // ─── Admin ──────────────────────────────────────────────────────────────────
  {
    name: 'setup',
    desc: 'Mở bảng điều khiển quản trị',
    category: 'admin',
    audience: 'admin',
    examples: ['/setup'],
  },
  {
    name: 'mark',
    desc: 'Điểm danh thay cho thành viên',
    category: 'admin',
    audience: 'admin',
    examples: ['/mark user:@user status:tham_gia'],
  },

  // ─── General ────────────────────────────────────────────────────────────────
  {
    name: 'help',
    desc: 'Hiển thị danh sách lệnh + hướng dẫn',
    category: 'general',
    audience: 'both',
    examples: ['/help'],
  },
];

export function byAudience(audience) {
  if (audience === 'admin') return COMMAND_REGISTRY.filter(c => c.audience === 'admin' || c.audience === 'both');
  if (audience === 'user')  return COMMAND_REGISTRY.filter(c => c.audience === 'user'  || c.audience === 'both');
  return COMMAND_REGISTRY;
}
