// commands/help.js
'use strict';
const { Command } = require('@sapphire/framework');
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');

const COMMANDS_INFO = [
  { name: '/bat_dau', desc: 'Mở phiên điểm danh mới' },
  { name: '/ket_thuc', desc: 'Kết thúc phiên đang mở' },
  { name: '/diemdanh', desc: 'Điểm danh tham gia phiên' },
  { name: '/quanlyphien', desc: 'Quản lý phiên điểm danh' },
  { name: '/lichcodinh', desc: 'Cài đặt lịch điểm danh tự động' },
  { name: '/thong_ke', desc: 'Xem thống kê cá nhân' },
  { name: '/thongke_server', desc: 'Xem thống kê toàn server' },
  { name: '/lichsu', desc: 'Lịch sử phiên điểm danh' },
  { name: '/rank', desc: 'Bảng xếp hạng' },
  { name: '/xuat', desc: 'Xuất dữ liệu CSV' },
  { name: '/log', desc: 'Quản lý log channel' },
  { name: '/caidat', desc: 'Cài đặt server' },
  { name: '/setup', desc: 'Bảng điều khiển' },
  { name: '/toi', desc: 'Panel cá nhân' },
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

// giữ lại handleSelectMenu để interactionCreate.js cũ không bị break (sẽ xóa khi Phase 3)
function handleSelectMenu(interaction) {
  return interaction.reply({ content: 'Vào /help để xem các lệnh.', ephemeral: true }).catch(() => null);
}

module.exports = { HelpCommand, handleSelectMenu };
