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
  // ───── PHIÊN (admin) ─────
  { name: 'batdau',  category: 'PHIEN',     audience: 'admin',
    desc: 'Mở phiên điểm danh mới',
    detail: 'Tạo phiên mới trong channel hiện tại, kèm nút bấm cho thành viên điểm danh.\n'
      + 'Tuỳ chọn `phut` để tự động đóng sau N phút. Tuỳ chọn `phai` để giới hạn điểm danh theo role.',
    ephemeral: false, examples: ['/batdau', '/batdau ten_phien:Sinh hoạt lớp phut:60', '/batdau phai:@Lớp-A'] },
  { name: 'ketthuc', category: 'PHIEN',     audience: 'admin',
    desc: 'Kết thúc phiên đang mở và gửi báo cáo',
    detail: 'Đóng phiên hiện tại, gửi embed tổng kết có thống kê chi tiết, cập nhật member_stats.', ephemeral: false },
  { name: 'status',  category: 'PHIEN',     audience: 'user',
    desc: 'Trạng thái nhanh phiên hiện tại (compact)', ephemeral: true },

  // ───── ĐIỂM DANH (user) ─────
  { name: 'diemdanh', category: 'DIEM_DANH', audience: 'user',
    desc: 'Điểm danh tham gia phiên hiện tại', ephemeral: true,
    detail: 'Đánh dấu bạn là tham gia / trễ / có phép. Mặc định là tham gia.',
    examples: ['/diemdanh', '/diemdanh trang_thai:⏰ Trễ'] },

  // ───── TIỆN ÍCH (mọi người) ─────
  { name: 'help',    category: 'TIEN_ICH',  audience: 'user',
    desc: 'Hiển thị danh sách lệnh + hướng dẫn', ephemeral: true },

  // ───── CÀI ĐẶT (admin) ─────
  { name: 'setup',   category: 'PHIEN',     audience: 'admin',
    desc: 'Bảng điều khiển — quản lý lịch, thành viên, phiên, cài đặt', ephemeral: true,
    detail: 'Smart Home dashboard với 4 sections: Phiên đang mở, Cài đặt chung, Lịch cố định, Thành viên.\n'
      + 'Đây là hub duy nhất cho mọi thao tác quản trị — không cần nhớ subcommand.' },

  // ───── ADMIN DASHBOARD (admin) ─────
  { name: 'admin',   category: 'TIEN_ICH',  audience: 'admin',
    desc: 'Dashboard Admin — quản lý phiên điểm danh tập trung', ephemeral: true,
    detail: 'StringSelectMenu tập trung: xem danh sách, điểm danh thay, xuất CSV, làm mới embed, đóng phiên.\n'
      + 'Tất cả reply đều ephemeral. Chỉ admin (ManageGuild) mới dùng được.' },
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
