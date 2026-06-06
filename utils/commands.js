// utils/commands.js — Central registry cho toàn bộ slash commands
'use strict';

const CATEGORIES = {
  TIEN_ICH:   { id: 'TIEN_ICH',   emoji: '\uD83D\uDEE0\uFE0F', label: 'Tiện ích' },
  QUAN_LY:    { id: 'QUAN_LY',    emoji: '\u2699\uFE0F',  label: 'Quản lý (qua /setup)' },
  DIEM_DANH:  { id: 'DIEM_DANH', emoji: '\u2705',  label: 'Điểm danh' },
  THONG_KE:   { id: 'THONG_KE',  emoji: '\uD83D\uDCCA',  label: 'Thống kê & Lịch sử' },
};

const AUDIENCES = {
  USER:  { id: 'USER',  emoji: '\uD83D\uDC64', label: 'Cho mọi người', desc: 'Không cần quyền đặc biệt.' },
  ADMIN: { id: 'ADMIN', emoji: '\uD83D\uDEE1\uFE0F', label: 'Cho Admin', desc: 'Cần quyền **Quản lý Server** (Manage Guild).' },
};

const COMMANDS = [
  // ── Lệnh slash ──────────────────────────────────────────────────────────────
  {
    name: 'help', category: 'TIEN_ICH', audience: 'user', ephemeral: true,
    desc: 'Hiển thị danh sách lệnh + hướng dẫn sử dụng',
  },
  {
    name: 'setup', category: 'QUAN_LY', audience: 'admin', ephemeral: true,
    desc: 'Mở Bảng điều khiển — quản lý mọi thứ từ 1 nơi',
    detail: 'Hub quản trị tập trung: mở/đóng phiên, cấu hình kênh, quản lý thành viên, lịch cố định, xem nhật ký và thống kê.',
    examples: ['/setup'],
  },

  // ── Embed phiên (điều khiển bằng nút) ───────────────────────────────
  {
    name: 'Chọn trạng thái điểm danh', category: 'DIEM_DANH', audience: 'user',
    desc: 'Chọn Tham gia / Vắng / Có phép / Trễ từ menu dropdown trong embed phiên',
  },
  {
    name: 'Xem danh sách', category: 'DIEM_DANH', audience: 'user',
    desc: 'Xem ai đã điểm danh, trạng thái từng người trong phiên hiện tại',
  },
  {
    name: 'Làm mới embed', category: 'DIEM_DANH', audience: 'user',
    desc: 'Cập nhật lại số liệu điểm danh trên embed phiên ngay lập tức',
  },
  {
    name: 'Điểm danh thay', category: 'DIEM_DANH', audience: 'admin',
    desc: 'Admin chọn thành viên và trạng thái bất kỳ thay cho họ (trong embed phiên)',
  },
  {
    name: 'Xuất CSV', category: 'DIEM_DANH', audience: 'admin',
    desc: 'Tải file CSV danh sách điểm danh phiên đang mở',
  },
  {
    name: 'Huỷ phiên', category: 'QUAN_LY', audience: 'admin',
    desc: 'Xóa phiên đang mở, không lưu dữ liệu điểm danh',
  },
  {
    name: 'Đóng phiên', category: 'QUAN_LY', audience: 'admin',
    desc: 'Kết thúc phiên, lưu dữ liệu và gửi tổng kết vào kênh',
  },

  // ── Các nút trong /setup ───────────────────────────────────────────
  {
    name: 'Cài đặt', category: 'QUAN_LY', audience: 'admin',
    desc: 'Chỉnh kênh log, vai trò Phái, timezone — từ Bảng điều khiển',
  },
  {
    name: 'Lịch cố định', category: 'QUAN_LY', audience: 'admin',
    desc: 'Thêm/xóa lịch tự động mở phiên theo giờ hằng tuần',
  },
  {
    name: 'Thành viên', category: 'QUAN_LY', audience: 'admin',
    desc: 'Thêm/xóa thành viên khỏi danh sách eligible (tính streak & vắng)',
  },
  {
    name: 'Nhật ký', category: 'THONG_KE', audience: 'admin',
    desc: 'Xem lịch sử tất cả phiên đã đóng của server, phân trang',
  },
  {
    name: 'Thống kê', category: 'THONG_KE', audience: 'admin',
    desc: 'Bảng xếp hạng streak, tỉ lệ tham gia, huy hiệu thành viên',
  },
  {
    name: 'Phát tin', category: 'QUAN_LY', audience: 'admin',
    desc: 'Gửi thông báo tùy chỉnh vào kênh log của server',
  },
];

const COMMANDS_BY_NAME = new Map(COMMANDS.map(c => [c.name, c]));

function getCmd(name) { return COMMANDS_BY_NAME.get(name); }
function byAudience(audience) { return COMMANDS.filter(c => c.audience === audience); }
function byCategory(catId) { return COMMANDS.filter(c => c.category === catId); }

module.exports = { CATEGORIES, AUDIENCES, COMMANDS, getCmd, byAudience, byCategory };
