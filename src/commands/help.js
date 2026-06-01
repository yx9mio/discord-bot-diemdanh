// src/commands/help.js
'use strict';
const { Command } = require('@sapphire/framework');
const { EmbedBuilder, MessageFlags } = require('discord.js');

const COMMANDS_INFO = [
  { name: '/bat_dau',      desc: 'Mở phiên điểm danh mới' },
  { name: '/ket_thuc',     desc: 'Kết thúc phiên đang mở' },
  { name: '/huy',          desc: 'Hủy phiên (không lưu)' },
  { name: '/diemdanh',     desc: 'Điểm danh tham gia phiên' },
  { name: '/xem',          desc: 'Xem danh sách điểm danh (thêm nút bấm với nut_bam:true)' },
  { name: '/quanlyphien',  desc: 'Quản lý phiên điểm danh' },
  { name: '/lichcodinh',   desc: 'Cài đặt lịch điểm danh tự động' },
  { name: '/thongke',      desc: 'Thống kê (ca_nhan / phien / server)' },
  { name: '/lichsu',       desc: 'Lịch sử phiên điểm danh' },
  { name: '/rank',         desc: 'Bảng xếp hạng' },
  { name: '/toi',          desc: 'Thống kê cá nhân nhanh' },
  { name: '/member',       desc: 'Xem thông tin thành viên (Admin)' },
  { name: '/sua',          desc: 'Sửa trạng thái điểm danh (Admin)' },
  { name: '/them',         desc: 'Thêm thành viên vào phiên (Admin)' },
  { name: '/xoa',          desc: 'Xóa điểm danh thành viên (Admin)' },
  { name: '/broadcast',    desc: 'Ping người chưa điểm danh (Admin)' },
  { name: '/nhacnho',      desc: 'Bật/tắt nhắc nhở tự động (Admin)' },
  { name: '/resetstreak',  desc: 'Reset streak thành viên (Admin)' },
  { name: '/xuat',         desc: 'Xuất dữ liệu CSV (Admin)' },
  { name: '/log',          desc: 'Xem log bot (Admin)' },
  { name: '/caidat',       desc: 'Cài đặt server (Admin)' },
  { name: '/caidatphai',   desc: 'Quản lý role phái (Admin)' },
  { name: '/status',       desc: 'Trạng thái bot' },
];

class HelpCommand extends Command {
  constructor(context) {
    super(context, { name: 'help', description: 'Hiển thị danh sách lệnh' });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(builder =>
      builder.setName('help').setDescription('Hiển thị danh sách lệnh và hướng dẫn')
    );
  }

  async chatInputRun(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x01696f)
      .setTitle('📚 Danh sách lệnh')
      .setDescription(COMMANDS_INFO.map(c => `**${c.name}** — ${c.desc}`).join('\n'))
      .setFooter({ text: 'Quản Gia · Bot Điểm Danh' });
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

module.exports = { HelpCommand };
