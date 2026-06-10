'use strict';

const CATEGORIES = {
  session:  { emoji: '📋', label: 'Quản lý phiên' },
  stats:    { emoji: '📊', label: 'Thống kê' },
  admin:    { emoji: '🛡️', label: 'Quản trị' },
  general:  { emoji: 'ℹ️', label: 'Chung' },
};

const COMMAND_REGISTRY = [
  { name: 'start',   desc: 'Mở phiên điểm danh mới',                                       category: 'session', audience: 'admin', examples: ['/start tên:Họp tuần'] },
  { name: 'close',   desc: 'Đóng phiên điểm danh đang mở',                                 category: 'session', audience: 'admin' },
  { name: 'cancel',  desc: 'Hủy phiên điểm danh đang mở',                                  category: 'session', audience: 'admin' },
  { name: 'status',  desc: 'Xem trạng thái phiên hiện tại',                                category: 'session', audience: 'both',  examples: ['/status'] },

  { name: 'mystats',     desc: 'Xem thống kê điểm danh của bạn',                           category: 'stats', audience: 'user',  examples: ['/mystats'] },
  { name: 'stats',       desc: 'Xem thống kê điểm danh của một thành viên',                category: 'stats', audience: 'admin', examples: ['/stats user:@user'] },
  { name: 'leaderboard', desc: 'Bảng xếp hạng điểm danh',                                  category: 'stats', audience: 'both',  examples: ['/leaderboard'] },

  { name: 'setup', desc: 'Mở bảng điều khiển quản trị',                                    category: 'admin', audience: 'admin', examples: ['/setup'] },
  { name: 'mark',  desc: 'Điểm danh thay cho thành viên',                                  category: 'admin', audience: 'admin', examples: ['/mark user:@user status:tham_gia'] },

  { name: 'help',  desc: 'Hiển thị danh sách lệnh + hướng dẫn',                            category: 'general', audience: 'both', examples: ['/help'] },
];

function byAudience(audience) {
  if (audience === 'admin') return COMMAND_REGISTRY.filter(c => c.audience === 'admin' || c.audience === 'both');
  if (audience === 'user')  return COMMAND_REGISTRY.filter(c => c.audience === 'user'  || c.audience === 'both');
  return COMMAND_REGISTRY;
}

module.exports = { CATEGORIES, COMMAND_REGISTRY, byAudience };
