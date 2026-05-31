// commands/help.js
// Sync với design system embeds.js — dùng COLORS.PRIMARY, AUTHOR_DEFAULT, FOOTER_DEFAULT
'use strict';
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
const { COLORS, AUTHOR_DEFAULT, FOOTER_DEFAULT } = require('../utils/embeds.js');

const SECTIONS = {
  diemdanh: {
    label: '📋 Điểm Danh',
    desc: 'Các lệnh quản lý phiên điểm danh',
    fields: [
      { name: '/bat_dau',      value: 'Bắt đầu phiên điểm danh mới', inline: false },
      { name: '/ket_thuc',     value: 'Kết thúc phiên và lưu kết quả', inline: false },
      { name: '/huy_diemdanh',value: 'Hủy phiên (không lưu kết quả)', inline: false },
      { name: '/diem_danh',   value: 'Sửa trạng thái điểm danh từ admin', inline: false },
      { name: '/broadcast',   value: 'Ping những người chưa điểm danh', inline: false },
    ],
  },
  thongke: {
    label: '📊 Thống Kê',
    desc: 'Xem thống kê, xếp hạng và lịch sử',
    fields: [
      { name: '/toi',             value: 'Xem thống kê cá nhân của bạn', inline: false },
      { name: '/rank',            value: 'Bảng xếp hạng điểm danh server', inline: false },
      { name: '/thong_ke',        value: 'Thống kê chi tiết một thành viên', inline: false },
      { name: '/thongke_server',  value: 'Thống kê tổng quan toàn server', inline: false },
      { name: '/lich_su',         value: 'Lịch sử phiên điểm danh (có phân trang)', inline: false },
      { name: '/xem_diemdanh',    value: 'Xem chi tiết một phiên cụ thể', inline: false },
    ],
  },
  caidat: {
    label: '⚙️ Cài Đặt',
    desc: 'Cấu hình bot và lịch tự động',
    fields: [
      { name: '/quanly',        value: 'Mở bảng điều khiển bot (Admin)', inline: false },
      { name: '/cai_dat',       value: 'Thiết lập role điểm danh & admin', inline: false },
      { name: '/cai_dat_phai',  value: 'Cấu hình role phái', inline: false },
      { name: '/lich_co_dinh',  value: 'Xem / thêm / xóa lịch điểm danh cố định', inline: false },
      { name: '/nhac_nho',      value: 'Bật / tắt nhắc nhở tự động trước phiên', inline: false },
    ],
  },
};

function buildMainEmbed() {
  return new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle('📖 Hướng Dẫn Sử Dụng — Quản Gia')
    .setColor(COLORS.PRIMARY)
    .setDescription(
      '> Chọn danh mục bên dưới để xem chi tiết các lệnh.\n' +
      '> Dùng `/quanly` để mở bảng điều khiển đầy đủ (Admin).'
    )
    .addFields(
      { name: '📋 Điểm Danh', value: 'Quản lý phiên điểm danh', inline: true },
      { name: '📊 Thống Kê',  value: 'Xem thống kê, xếp hạng', inline: true },
      { name: '⚙️ Cài Đặt',  value: 'Cấu hình bot & lịch cố định', inline: true },
    )
    .setFooter({ text: `${FOOTER_DEFAULT} — Bot điểm danh tự động` })
    .setTimestamp();
}

function buildSectionEmbed(key) {
  const s = SECTIONS[key];
  if (!s) return buildMainEmbed();
  return new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle(s.label)
    .setColor(COLORS.PRIMARY)
    .setDescription(`> ${s.desc}`)
    .addFields(s.fields)
    .setFooter({ text: `${FOOTER_DEFAULT} — Dùng /help để quay lại menu chính` })
    .setTimestamp();
}

function buildSelectMenu(placeholder = 'Chọn danh mục...') {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('help:menu')
      .setPlaceholder(placeholder)
      .addOptions(
        Object.entries(SECTIONS).map(([value, s]) => ({
          label: s.label,
          description: s.desc,
          value,
        }))
      )
  );
}

async function handleSelectMenu(interaction) {
  if (interaction.customId !== 'help:menu') return;
  await interaction.deferUpdate();
  const key   = interaction.values[0];
  const embed = buildSectionEmbed(key);
  return interaction.editReply({ embeds: [embed], components: [buildSelectMenu()] });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Xem hướng dẫn sử dụng bot')
    .setDefaultMemberPermissions(0n),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    return interaction.editReply({
      embeds: [buildMainEmbed()],
      components: [buildSelectMenu()],
    });
  },

  handleSelectMenu,
  buildMainEmbed,
  buildSectionEmbed,
  buildSelectMenu,
};
