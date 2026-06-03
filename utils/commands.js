// utils/commands.js — Central registry cho toàn bộ slash commands
// Commit 6: chỉ giữ 2 commands cơ bản (/help, /setup). Mọi thao tác khác qua UI.

'use strict';

const CATEGORIES = {
  TIEN_ICH:  { id: 'TIEN_ICH',  emoji: '🛠️', label: 'Tiện ích' },
};

const AUDIENCES = {
  USER:  { id: 'USER',  emoji: '👤', label: 'Cho mọi người',  desc: 'Không cần quyền đặc biệt.' },
  ADMIN: { id: 'ADMIN', emoji: '🛡️', label: 'Cho Admin',       desc: 'Cần quyền **Quản lý Server** (Manage Guild).' },
};

const COMMANDS = [
  { name: 'help',    category: 'TIEN_ICH',  audience: 'user',
    desc: 'Hiển thị danh sách lệnh + hướng dẫn', ephemeral: true },

  { name: 'setup',   category: 'TIEN_ICH',     audience: 'admin',
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
