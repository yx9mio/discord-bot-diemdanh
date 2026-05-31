// commands/help.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');

const SECTIONS = {
  diemdanh: {
    label: '📋 Điểm Danh',
    desc: 'Các lệnh quản lý phiên điểm danh',
    fields: [
      { name: '/bat_dau', value: 'Bắt đầu phiên điểm danh mới' },
      { name: '/ket_thuc', value: 'Kết thúc phiên hiện tại' },
      { name: '/huy_diemdanh', value: 'Hủy phiên (không lưu kết quả)' },
      { name: '/diem_danh', value: 'Sửa trạng thái điểm danh từ dịch vụ' },
      { name: '/broadcast', value: 'Ping những người chưa điểm danh' },
    ],
  },
  thongke: {
    label: '📊 Thống Kê',
    desc: 'Xem thống kê và xếp hạng',
    fields: [
      { name: '/toi', value: 'Xem thống kê cá nhân của bạn' },
      { name: '/rank', value: 'Bảng xếp hạng điểm danh' },
      { name: '/thong_ke', value: 'Thống kê toàn bộ server' },
      { name: '/lich_su', value: 'Lịch sử phiên điểm danh' },
    ],
  },
  caidat: {
    label: '⚙️ Cài Đặt',
    desc: 'Cấu hình bot',
    fields: [
      { name: '/quanly', value: 'Mở bảng quản lý bot (Admin)' },
      { name: '/cai_dat', value: 'Thiết lập role điểm danh / admin' },
      { name: '/cai_dat_phai', value: 'Cấu hình role phái' },
    ],
  },
};

function buildMainEmbed() {
  return new EmbedBuilder()
    .setTitle('📖 Hướng Dẫn Sử Dụng Bot')
    .setColor(0x5865F2)
    .setDescription('Chọn danh mục bên dưới để xem chi tiết các lệnh.')
    .addFields(
      { name: '📋 Điểm Danh', value: 'Quản lý phiên điểm danh', inline: true },
      { name: '📊 Thống Kê', value: 'Xem thống kê, xếp hạng', inline: true },
      { name: '⚙️ Cài Đặt', value: 'Cấu hình bot', inline: true },
    )
    .setFooter({ text: 'Quản Gia — Bot điểm danh' })
    .setTimestamp();
}

function buildSectionEmbed(key) {
  const s = SECTIONS[key];
  if (!s) return buildMainEmbed();
  return new EmbedBuilder()
    .setTitle(s.label)
    .setColor(0x5865F2)
    .setDescription(s.desc)
    .addFields(s.fields)
    .setFooter({ text: 'Quản Gia — Bot điểm danh' })
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
