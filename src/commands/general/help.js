// src/commands/general/help.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

const COMMANDS_INFO = [
  // 📅 Phiên
  { cat: 'session',  emoji: '📅', label: 'Phiên',
    items: [
      { name: '/bat_dau',      desc: 'Mở phiên điểm danh mới' },
      { name: '/ket_thuc',     desc: 'Kết thúc phiên đang mở' },
      { name: '/huy',          desc: 'Hủy phiên (không lưu kết quả)' },
      { name: '/status',       desc: 'Xem trạng thái phiên đang chạy' },
      { name: '/quanlyphien',  desc: 'Quản lý phiên (đóng/hủy nhanh)' },
    ]},
  // ✅ Điểm danh
  { cat: 'attendance', emoji: '✅', label: 'Điểm danh',
    items: [
      { name: '/diemdanh',     desc: 'Điểm danh tham gia phiên' },
      { name: '/xem_diemdanh', desc: 'Xem danh sách điểm danh hiện tại' },
      { name: '/toi',          desc: 'Xem thông tin cá nhân (streak, huy hiệu)' },
      { name: '/them',         desc: '[Admin] Thêm 1 thành viên thủ công' },
      { name: '/sua',          desc: '[Admin] Sửa status hàng loạt' },
      { name: '/xoa',          desc: '[Admin] Xóa điểm danh của 1 người' },
    ]},
  // 📊 Thống kê
  { cat: 'stats', emoji: '📊', label: 'Thống kê',
    items: [
      { name: '/thong_ke',       desc: 'Thống kê cá nhân' },
      { name: '/thongke_server', desc: 'Thống kê toàn server' },
      { name: '/thongkephien',   desc: 'Chi tiết một phiên cụ thể' },
      { name: '/lichsu',         desc: 'Lịch sử 10 phiên gần nhất' },
      { name: '/rank',           desc: 'Bảng xếp hạng top 10' },
      { name: '/xuat',           desc: '[Admin] Xuất CSV' },
    ]},
  // 👥 Thành viên
  { cat: 'members', emoji: '👥', label: 'Thành viên',
    items: [
      { name: '/member',       desc: 'Tra cứu thông tin 1 thành viên' },
      { name: '/xem',          desc: 'Xem danh sách thành viên' },
      { name: '/resetstreak',  desc: '[Admin] Reset streak thành viên' },
    ]},
  // ⚙️ Admin
  { cat: 'admin', emoji: '⚙️', label: 'Admin',
    items: [
      { name: '/caidat',       desc: 'Cài đặt chung (role admin, role mặc định)' },
      { name: '/caidatphai',   desc: 'Cài đặt danh sách phái' },
      { name: '/lichcodinh',   desc: 'Lịch tự động mở/đóng phiên' },
      { name: '/nhacnho',      desc: 'Cài đặt nhắc nhở trước khi đóng' },
      { name: '/broadcast',    desc: 'Ping người chưa điểm danh' },
      { name: '/log',          desc: 'Xem log hoạt động bot' },
      { name: '/setup',        desc: 'Hướng dẫn cài đặt nhanh' },
    ]},
];

function buildHelpEmbed() {
  const fields = COMMANDS_INFO.map(cat => ({
    name: `${cat.emoji} ${cat.label}`,
    value: cat.items.map(i => `**${i.name}** — ${i.desc}`).join('\n'),
    inline: false,
  }));
  return new EmbedBuilder()
    .setColor(0x01696f)
    .setTitle('📚 Danh sách lệnh — Quản Gia Bot')
    .setDescription('💡 Gõ `/` rồi bắt đầu gõ tên lệnh để Discord tự gợi ý. '
      + 'Cột **[Admin]** cần quyền quản lý server.')
    .addFields(...fields)
    .setFooter({ text: 'Quản Gia · Bot Điểm Danh' })
    .setTimestamp();
}

class HelpCommand extends Command {
  constructor(context) {
    super(context, { name: 'help', description: 'Hiển thị danh sách lệnh' });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder().setName('help').setDescription('Hiển thị danh sách lệnh và hướng dẫn')
    );
  }

  async chatInputRun(interaction) {
    await interaction.reply({ embeds: [buildHelpEmbed()], flags: MessageFlags.Ephemeral });
  }
}

module.exports = { HelpCommand, COMMANDS_INFO };
