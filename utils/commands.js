// utils/commands.js — Central registry cho toàn bộ slash commands
// Mục đích:
// 1. Help command tự động generate embed từ metadata ở đây
// 2. Phân loại User / Admin rõ ràng
// 3. Có thể tự động validate consistency giữa file command + registry
//
// Schema mỗi command:
//   name        — string — slash command name (vd: 'diemdanh')
//   desc        — string — mô tả ngắn 1 dòng hiển thị trong help
//   detail      — string — mô tả dài hơn (optional) cho help detail view
//   audience    — 'user' | 'admin'
//   category    — nhóm hiển thị trong help (PHIEN, DIEM_DANH, CAI_DAT, ...)
//   ephemeral   — boolean — mặc định reply có ephemeral không
//   examples    — string[] — ví dụ sử dụng (optional)

'use strict';

const CATEGORIES = {
  PHIEN:       { id: 'PHIEN',       emoji: '📅', label: 'Phiên' },
  DIEM_DANH:   { id: 'DIEM_DANH',   emoji: '✅', label: 'Điểm danh' },
  CA_NHAN:     { id: 'CA_NHAN',     emoji: '👤', label: 'Cá nhân' },
  LICH_SU:     { id: 'LICH_SU',     emoji: '📜', label: 'Lịch sử' },
  THANH_VIEN:  { id: 'THANH_VIEN',  emoji: '👥', label: 'Thành viên' },
  LICH:        { id: 'LICH',        emoji: '⏰', label: 'Lịch tự động' },
  THONG_KE:    { id: 'THONG_KE',    emoji: '📊', label: 'Thống kê' },
  CAI_DAT:     { id: 'CAI_DAT',     emoji: '⚙️', label: 'Cài đặt' },
  TIEN_ICH:    { id: 'TIEN_ICH',    emoji: '🛠️', label: 'Tiện ích' },
};

// audiences — nhóm cho help
const AUDIENCES = {
  USER:  { id: 'USER',  emoji: '👤', label: 'Cho mọi người',  desc: 'Không cần quyền đặc biệt.' },
  ADMIN: { id: 'ADMIN', emoji: '🛡️', label: 'Cho Admin',       desc: 'Cần quyền **Quản lý Server** (Manage Guild).' },
};

// Metadata cho từng command — export để help.js dùng
const COMMANDS = [
  // ───── PHIÊN (admin) ─────
  { name: 'bat_dau',       category: 'PHIEN',      audience: 'admin',
    desc: 'Mở phiên điểm danh mới',
    detail: 'Tạo phiên mới trong channel hiện tại, kèm nút bấm cho thành viên điểm danh.\n'
      + 'Tuỳ chọn `phut` để tự động đóng sau N phút. Tuỳ chọn `phai` để giới hạn điểm danh theo role.',
    ephemeral: false, examples: ['/bat_dau', '/bat_dau ten_phien:Sinh hoạt lớp phut:60', '/bat_dau phai:@Lớp-A'] },
  { name: 'ket_thuc',      category: 'PHIEN',      audience: 'admin',
    desc: 'Kết thúc phiên đang mở và gửi báo cáo',
    detail: 'Đóng phiên hiện tại, gửi embed tổng kết có thống kê chi tiết, cập nhật member_stats.', ephemeral: false },
  { name: 'huy',           category: 'PHIEN',      audience: 'admin',
    desc: 'Huỷ phiên hiện tại (không lưu kết quả)', ephemeral: true,
    detail: 'Đánh dấu phiên là cancelled, không tính streak, không cấp huy hiệu.' },
  { name: 'quanlyphien',   category: 'PHIEN',      audience: 'admin',
    desc: 'Quản lý phiên (xem/huỷ nhanh)',
    detail: 'Có 3 subcommand:\n'
      + '• `hien_tai` — xem phiên đang chạy\n'
      + '• `lich_su` — lịch sử N phiên gần nhất\n'
      + '• `diem_danh_vang` — chọn thành viên vắng và đánh dấu hàng loạt', ephemeral: true },
  { name: 'broadcast',     category: 'PHIEN',      audience: 'admin',
    desc: 'Ping nhắc nhở người chưa điểm danh', ephemeral: true,
    detail: 'Gửi embed đến channel hiện tại kèm mention tất cả thành viên eligible chưa điểm danh.' },

  // ───── ĐIỂM DANH (user) ─────
  { name: 'diemdanh',      category: 'DIEM_DANH',  audience: 'user',
    desc: 'Điểm danh tham gia phiên hiện tại', ephemeral: true,
    detail: 'Đánh dấu bạn là tham gia / trễ / có phép. Mặc định là tham gia.',
    examples: ['/diemdanh', '/diemdanh trang_thai:⏰ Trễ'] },
  { name: 'xem_diemdanh',  category: 'DIEM_DANH',  audience: 'user',
    desc: 'Xem danh sách điểm danh phiên hiện tại', ephemeral: false,
    detail: 'Hiển thị 4 nhóm: Tham gia, Trễ, Có phép, Vắng. Có nút **Làm mới** để cập nhật.' },

  // ───── CÁ NHÂN (user) ─────
  { name: 'toi',           category: 'CA_NHAN',    audience: 'user',
    desc: 'Thông tin điểm danh cá nhân của bạn', ephemeral: true,
    detail: 'Hiển thị streak hiện tại, best streak, tổng phiên tham gia, tổng trễ, tổng vắng, huy hiệu đã đạt.' },
  { name: 'thong_ke',      category: 'CA_NHAN',    audience: 'user',
    desc: 'Xem thống kê của 1 thành viên (mặc định: bạn)', ephemeral: true,
    detail: 'Giống `/toi` nhưng có thể chỉ định user khác (chỉ thấy được public stats).' },
  { name: 'rank',          category: 'CA_NHAN',    audience: 'user',
    desc: 'Bảng xếp hạng top 10 người điểm danh nhiều nhất', ephemeral: true,
    detail: 'Xếp hạng theo `total_joined` (số phiên tham gia). Top 3 có huy chương 🥇🥈🥉.' },

  // ───── LỊCH SỬ (user) ─────
  { name: 'lichsu',        category: 'LICH_SU',    audience: 'user',
    desc: 'Lịch sử các phiên đã chạy', ephemeral: true,
    detail: 'Có phân trang (mặc định 10/trang, max 25). Dùng nút ◀ ▶ để chuyển trang.',
    examples: ['/lichsu', '/lichsu so_luong:25'] },

  // ───── THÀNH VIÊN (admin) ─────
  { name: 'them',          category: 'THANH_VIEN', audience: 'admin',
    desc: 'Thêm 1 thành viên vào danh sách quản lý', ephemeral: true,
    detail: 'Có confirm trước khi lưu.', examples: ['/them user:@Moi phong_ban:Media'] },
  { name: 'sua',           category: 'THANH_VIEN', audience: 'admin',
    desc: 'Sửa phòng ban của thành viên', ephemeral: true },
  { name: 'xoa',           category: 'THANH_VIEN', audience: 'admin',
    desc: 'Xoá thành viên khỏi danh sách', ephemeral: true,
    detail: 'Có confirm. Xoá cả điểm danh + member_stats liên quan.' },
  { name: 'xem',           category: 'THANH_VIEN', audience: 'admin',
    desc: 'Xem danh sách thành viên được quản lý', ephemeral: true },
  { name: 'member',        category: 'THANH_VIEN', audience: 'admin',
    desc: 'Tra cứu thông tin chi tiết 1 thành viên', ephemeral: true },
  { name: 'resetstreak',   category: 'THANH_VIEN', audience: 'admin',
    desc: 'Reset streak điểm danh của 1 thành viên', ephemeral: true,
    detail: 'Có confirm. Set current_streak = 0 (giữ nguyên best_streak).' },

  // ───── LỊCH TỰ ĐỘNG (admin) ─────
  { name: 'lichcodinh',    category: 'LICH',       audience: 'admin',
    desc: 'Quản lý lịch tự động mở/đóng phiên', ephemeral: true,
    detail: 'Có 5 subcommand: xem / them / xoa / xoa_tat_ca / bat_tat.\n'
      + 'Bấm nút ✕ trong `/lichcodinh xem` để xoá từng dòng.' },
  { name: 'nhacnho',       category: 'LICH',       audience: 'admin',
    desc: 'Cài đặt nhắc nhở trước khi đóng phiên', ephemeral: true },

  // ───── THỐNG KÊ (admin) ─────
  { name: 'thongke_server', category: 'THONG_KE',  audience: 'admin',
    desc: 'Thống kê tổng quan toàn server', ephemeral: true },
  { name: 'thongkephien',  category: 'THONG_KE',   audience: 'admin',
    desc: 'Chi tiết 1 phiên cụ thể (theo session_id)', ephemeral: true,
    detail: 'Bỏ trống session_id → lấy phiên mới nhất. Hiển thị 4 nhóm trạng thái.' },
  { name: 'xuat',          category: 'THONG_KE',   audience: 'admin',
    desc: 'Xuất CSV điểm danh', ephemeral: true,
    detail: 'Có 2 loại: `Phiên hiện tại` (mặc định) hoặc `Tất cả phiên`.' },

  // ───── CÀI ĐẶT (admin) ─────
  { name: 'caidat',        category: 'CAI_DAT',    audience: 'admin',
    desc: 'Cài đặt chung (kênh log, timezone, reset)', ephemeral: true,
    detail: 'Có 4 subcommand: xem / kenh_log / timezone / reset.\n'
      + '`reset` xoá toàn bộ cài đặt về mặc định (có confirm).' },
  { name: 'caidatphai',    category: 'CAI_DAT',    audience: 'admin',
    desc: 'Cài đặt danh sách role phái được điểm danh', ephemeral: true,
    detail: '4 subcommand: xem / them / xoa / xoa_tat_ca.' },
  { name: 'setup',         category: 'CAI_DAT',    audience: 'admin',
    desc: 'Bảng điều khiển — quản lý lịch, thành viên, phiên, cài đặt', ephemeral: true,
    detail: 'Smart Home dashboard với 4 sections: Phiên đang mở, Cài đặt chung, Lịch cố định, Thành viên.\n'
      + 'Đây là hub duy nhất cho mọi thao tác quản trị — không cần nhớ subcommand.' },
  { name: 'log',           category: 'CAI_DAT',    audience: 'admin',
    desc: 'Xem log hoạt động của bot', ephemeral: true },
  { name: 'quanly',        category: 'CAI_DAT',    audience: 'admin',
    desc: 'Bảng điều khiển quản lý bot', ephemeral: true },

  // ───── TIỆN ÍCH (mọi người) ─────
  { name: 'status',        category: 'PHIEN',      audience: 'user',
    desc: 'Trạng thái nhanh phiên hiện tại (compact)', ephemeral: true },
  { name: 'help',          category: 'TIEN_ICH',   audience: 'user',
    desc: 'Hiển thị danh sách lệnh + hướng dẫn', ephemeral: true },
];

// Build helpers — tránh recompute mỗi lần
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
