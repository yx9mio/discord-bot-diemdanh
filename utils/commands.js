// utils/commands.js — Central registry cho toàn bộ slash commands
// Commit 6: chỉ giữ 6 commands (Q1=b: /batdau, /ketthuc, /status, /diemdanh, /help, /setup).
// [C1] Thêm /admin dashboard
// Đã xoá toàn bộ lệnh admin/user cũ; cấu hình/lịch/thành viên giờ làm qua /setup wizard.

'use strict';

const CATEGORIES = {
  PHIEN:     { id: 'PHIEN',     emoji: '📅', label: 'Phiên' },
  DIEM_DANH: { id: 'DIEM_DANH', emoji: '✅', label: 'Điểm danh' },
  TIEN_ICH:  { id: 'TIEN_ICH',  emoji: '🛠️', label: 'Tiện ích' },
};

const AUDIENCES = {
  USER:  { id: 'USER',  emoji: '👤', label: 'Cho mọi người',  desc: 'Không cần quyền đặc biệt.' },
  ADMIN: { id: 'ADMIN', emoji: '🛡️', label: 'Cho Admin',       desc: 'Cần quyền **Quản lý Server** (Manage Guild).' },
};

const COMMANDS = [
  // ───── ĐIỂM DANH (user) ─────
  { name: 'diemdanh', category: 'DIEM_DANH', audience: 'user',
    desc: 'Điểm danh tham gia phiên hiện tại', ephemeral: true,
    detail: 'Đánh dấu bạn là tham gia / trễ / có phép. Mặc định là tham gia.',
    examples: ['/diemdanh', '/diemdanh trang_thai:⏰ Trễ'] },

  // ───── TRẠNG THÁI (user) ─────
  { name: 'status',  category: 'PHIEN',     audience: 'user',
    desc: 'Trạng thái nhanh phiên hiện tại (compact)', ephemeral: true },

  // ───── TIỆN ÍCH (mọi người) ─────
  { name: 'help',    category: 'TIEN_ICH',  audience: 'user',
    desc: 'Hiển thị danh sách lệnh + hướng dẫn', ephemeral: true },

  // ───── CÀI ĐẶT (admin) ─────
  { name: 'setup',   category: 'PHIEN',     audience: 'admin',
    desc: 'Bảng điều khiển — quản lý lịch, thành viên, phiên, cài đặt', ephemeral: true,
    detail: 'Smart Home dashboard với 4 sections: Phiên đang mở, Cài đặt chung, Lịch cố định, Thành viên.\n'
      + 'Đây là hub duy nhất cho mọi thao tác quản trị — không cần nhớ subcommand.' },
];

const COMMANDS_BY_NAME = new Map(COMMANDS.map(c => [c.name, c]));

function getCmd(name) {
  return COMMANDS_BY_NAME.get(name);
}

function byAudience(audience) {
  return COMMANDS.filter(c => c.audience === audience);
}

function byCategory(catId) {
  return COMMANDS.filter(c => c.category === catId);
}

module.exports = {
  CATEGORIES, AUDIENCES, COMMANDS,
  getCmd, byAudience, byCategory,
};
