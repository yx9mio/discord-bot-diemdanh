// src/commands/general/help.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

const COMMANDS_INFO = [
  { cat: '📅 Phiên',       name: '/bat_dau',        desc: 'Mở phiên điểm danh mới' },
  { cat: '📅 Phiên',       name: '/ket_thuc',       desc: 'Kết thúc phiên đang mở' },
  { cat: '📅 Phiên',       name: '/huy',            desc: 'Hủy phiên (không lưu kết quả)' },
  { cat: '📅 Phiên',       name: '/quanlyphien',    desc: 'Quản lý phiên điểm danh' },
  { cat: '📅 Phiên',       name: '/status',         desc: 'Trạng thái phiên đang chạy' },
  { cat: '✅ Điểm danh',   name: '/diemdanh',       desc: 'Điểm danh tham gia phiên' },
  { cat: '✅ Điểm danh',   name: '/xem_diemdanh',   desc: 'Xem danh sách điểm danh hiện tại' },
  { cat: '✅ Điểm danh',   name: '/toi',            desc: 'Xem thông tin điểm danh của bạn' },
  { cat: '📊 Thống kê',   name: '/thong_ke',       desc: 'Thống kê cá nhân' },
  { cat: '📊 Thống kê',   name: '/thongke_server', desc: 'Thống kê toàn server' },
  { cat: '📊 Thống kê',   name: '/thongkephien',   desc: 'Chi tiết một phiên cụ thể' },
  { cat: '📊 Thống kê',   name: '/lichsu',         desc: 'Lịch sử phiên' },
  { cat: '📊 Thống kê',   name: '/rank',           desc: 'Bảng xếp hạng' },
  { cat: '⚙️ Admin',      name: '/caidat',         desc: 'Cài đặt server' },
  { cat: '⚙️ Admin',      name: '/caidatphai',     desc: 'Cài đặt phái' },
  { cat: '⚙️ Admin',      name: '/lichcodinh',     desc: 'Lịch điểm danh tự động' },
  { cat: '⚙️ Admin',      name: '/nhacnho',        desc: 'Cài đặt nhắc nhở' },
  { cat: '⚙️ Admin',      name: '/broadcast',      desc: 'Ping người chưa điểm danh' },
  { cat: '⚙️ Admin',      name: '/xuat',           desc: 'Xuất dữ liệu CSV' },
  { cat: '⚙️ Admin',      name: '/log',            desc: 'Xem log bot' },
  { cat: '⚙️ Admin',      name: '/setup',          desc: 'Hướng dẫn cài đặt' },
];

const CATEGORIES = [...new Set(COMMANDS_INFO.map(c => c.cat))];

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
    const fields = CATEGORIES.map(cat => ({
      name: cat,
      value: COMMANDS_INFO.filter(c => c.cat === cat).map(c => `**${c.name}** — ${c.desc}`).join('\n'),
      inline: false,
    }));

    const embed = new EmbedBuilder()
      .setColor(0x01696f)
      .setTitle('📚 Danh sách lệnh — Quản Gia Bot')
      .addFields(...fields)
      .setFooter({ text: 'Quản Gia · Bot Điểm Danh' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

module.exports = { HelpCommand };
