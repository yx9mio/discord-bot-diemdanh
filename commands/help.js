// commands/help.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('../utils/embeds.js');

const CATEGORIES = {
  diemdanh: {
    label: '📋 Điểm Danh',
    description: 'Mở, đóng, hủy phiên điểm danh',
    color: 0x5865F2,
    commands: [
      {
        name: '/bat_dau',
        usage: '/bat_dau ten:[tên] [phut:X] [gio_dong:H] [phut_dong:P]',
        desc: 'Mở phiên điểm danh mới.',
        note: 'Admin only. Chỉ 1 phiên tại 1 thời điểm.',
        examples: [
          '`/bat_dau ten:Bang Chiến` → mở phiên, không tự đóng',
          '`/bat_dau ten:Bang Chiến phut:60` → tự đóng sau 60 phút',
          '`/bat_dau ten:Bang Chiến gio_dong:22 phut_dong:0` → tự đóng lúc 22:00',
        ],
      },
      {
        name: '/ket_thuc',
        usage: '/ket_thuc',
        desc: 'Đóng phiên điểm danh đang mở, hiển thị kết quả.',
        note: 'Admin only.',
        examples: ['`/ket_thuc` → đóng phiên hiện tại'],
      },
      {
        name: '/huy_diemdanh',
        usage: '/huy_diemdanh',
        desc: 'Hủy phiên hiện tại. Phiên bị hủy sẽ không hiện trong lịch sử.',
        note: 'Admin only. Khác /ket_thuc — không tính vào thống kê.',
        examples: ['`/huy_diemdanh` → hủy phiên, dữ liệu bị ẩn'],
      },
      {
        name: '/xem',
        usage: '/xem',
        desc: 'Xem danh sách điểm danh của phiên hiện tại.',
        note: 'Ai cũng dùng được.',
        examples: ['`/xem` → hiển thị danh sách tham gia/vắng'],
      },
    ],
  },
  thanhvien: {
    label: '👤 Thành Viên',
    description: 'Điểm danh thủ công, sửa, xoá',
    color: 0x57F287,
    commands: [
      {
        name: '/them',
        usage: '/them thanh_vien:[@user] [trang_thai:...]',
        desc: 'Thêm thành viên vào phiên điểm danh thủ công.',
        note: 'Admin only.',
        examples: [
          '`/them thanh_vien:@Mio` → thêm với trạng thái mặc định (tham gia)',
          '`/them thanh_vien:@Mio trang_thai:tre` → thêm với trạng thái trễ',
        ],
      },
      {
        name: '/sua_diem_danh',
        usage: '/sua_diem_danh thanh_vien:[@user] trang_thai:[...]',
        desc: 'Sửa trạng thái điểm danh của thành viên trong phiên hiện tại.',
        note: 'Admin only.',
        examples: ['`/sua_diem_danh thanh_vien:@Mio trang_thai:vang_mat`'],
      },
      {
        name: '/xoa',
        usage: '/xoa thanh_vien:[@user]',
        desc: 'Xoá thành viên khỏi phiên điểm danh hiện tại.',
        note: 'Admin only.',
        examples: ['`/xoa thanh_vien:@Mio`'],
      },
      {
        name: '/sua',
        usage: '/sua ten:[tên mới]',
        desc: 'Đổi tên phiên điểm danh đang mở.',
        note: 'Admin only.',
        examples: ['`/sua ten:Bang Chiến Tuần 2`'],
      },
    ],
  },
  lichco: {
    label: '📅 Lịch Cố Định',
    description: 'Tạo lịch điểm danh tự động hằng tuần',
    color: 0xFEE75C,
    commands: [
      {
        name: '/lich_co_dinh them',
        usage: '/lich_co_dinh them ten:[tên] thu_mo:[thứ] gio_mo:[H] phut_mo:[P] ...',
        desc: 'Tạo lịch điểm danh tự động mở mỗi tuần theo thứ/giờ cài đặt.',
        note: 'Admin only. Phái lấy từ /cai_dat_phai (không cần nhập lại).',
        examples: [
          '`/lich_co_dinh them ten:Bang Chiến thu_mo:Thứ 6 gio_mo:20 phut_mo:0`',
          'Thêm thu_dong/gio_dong/phut_dong để tự đóng',
        ],
      },
      {
        name: '/lich_co_dinh xem',
        usage: '/lich_co_dinh xem',
        desc: 'Xem danh sách lịch cố định đang kích hoạt.',
        note: 'Ai cũng dùng được.',
        examples: ['`/lich_co_dinh xem`'],
      },
      {
        name: '/lich_co_dinh xoa',
        usage: '/lich_co_dinh xoa id:[ID]',
        desc: 'Xoá lịch cố định. Lấy ID từ `/lich_co_dinh xem`.',
        note: 'Admin only.',
        examples: ['`/lich_co_dinh xoa id:ab12cd34`'],
      },
    ],
  },
  caidat: {
    label: '⚙️ Cài Đặt',
    description: 'Cấu hình bot cho server',
    color: 0xEB459E,
    commands: [
      {
        name: '/cai_dat',
        usage: '/cai_dat [role_diem_danh:@role] [role_admin:@role]',
        desc: 'Cài role được phép điểm danh và role admin bot.',
        note: 'Cần quyền Quản trị server.',
        examples: [
          '`/cai_dat role_diem_danh:@Thành Viên` → chỉ role này mới được điểm danh',
          '`/cai_dat role_admin:@BQL` → role này có quyền dùng lệnh admin',
        ],
      },
      {
        name: '/cai_dat_phai',
        usage: '/cai_dat_phai phai_1:@role phai_2:@role ...',
        desc: 'Cài danh sách role phái cho server. Chạy 1 lần — tự động áp dụng cho mọi lịch.',
        note: 'Admin only. Tối đa 11 phái.',
        examples: [
          '`/cai_dat_phai phai_1:@Thiết Y phai_2:@Huyết Hà ...`',
        ],
      },
      {
        name: '/nhac_nho',
        usage: '/nhac_nho [phut:X]',
        desc: 'Bật/tắt nhắc nhở trước khi phiên mở (từ lịch cố định).',
        note: 'Admin only. Mặc định 15 phút trước.',
        examples: ['`/nhac_nho phut:10` → nhắc 10 phút trước khi mở'],
      },
    ],
  },
  thongke: {
    label: '📊 Thống Kê',
    description: 'Xem lịch sử, thống kê thành viên',
    color: 0xED4245,
    commands: [
      {
        name: '/thong_ke',
        usage: '/thong_ke [thanh_vien:@user]',
        desc: 'Xem thống kê điểm danh cá nhân (streak, tỉ lệ tham gia).',
        note: 'Không truyền @user → xem của bản thân.',
        examples: [
          '`/thong_ke` → xem thống kê của mình',
          '`/thong_ke thanh_vien:@Mio` → xem của người khác',
        ],
      },
      {
        name: '/thong_ke_phien',
        usage: '/thong_ke_phien [so_luong:N]',
        desc: 'Xem bảng xếp hạng điểm danh toàn server.',
        note: 'Ai cũng dùng được.',
        examples: ['`/thong_ke_phien` → top thành viên tham gia nhiều nhất'],
      },
      {
        name: '/lich_su',
        usage: '/lich_su [so_phien:N]',
        desc: 'Xem lịch sử N phiên gần nhất.',
        note: 'Ai cũng dùng được.',
        examples: ['`/lich_su` → 10 phiên gần nhất', '`/lich_su so_phien:20`'],
      },
      {
        name: '/xuat',
        usage: '/xuat [phien_id:ID]',
        desc: 'Xuất danh sách điểm danh ra file CSV.',
        note: 'Admin only.',
        examples: ['`/xuat` → xuất phiên gần nhất'],
      },
      {
        name: '/member',
        usage: '/member thanh_vien:[@user]',
        desc: 'Xem chi tiết lịch sử điểm danh của 1 thành viên.',
        note: 'Ai cũng dùng được.',
        examples: ['`/member thanh_vien:@Mio`'],
      },
    ],
  },
};

const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Hướng dẫn sử dụng bot điểm danh');

function buildOverviewEmbed() {
  const desc = Object.entries(CATEGORIES)
    .map(([, cat]) => `${cat.label}\n> ${cat.description}`)
    .join('\n\n');
  return new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle('📖 Hướng Dẫn Bot Điểm Danh')
    .setDescription(
      '**Chọn danh mục bên dưới để xem chi tiết lệnh.**\n\n' + desc
    )
    .addFields(
      { name: '🔑 Phân quyền', value: '**Admin**: owner server hoặc role admin được cài trong `/cai_dat`\n**Thành viên**: mọi người đều dùng được', inline: false },
      { name: '🚀 Bắt đầu nhanh', value: '1. `/cai_dat` — cài role\n2. `/cai_dat_phai` — cài role phái (1 lần)\n3. `/lich_co_dinh them` — tạo lịch tự động\nhoặc `/bat_dau` — mở phiên thủ công', inline: false },
    )
    .setColor(0x5865F2)
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();
}

function buildCategoryEmbed(catKey) {
  const cat = CATEGORIES[catKey];
  if (!cat) return null;
  const fields = cat.commands.map(cmd => ({
    name: cmd.name,
    value: [
      `> ${cmd.desc}`,
      `**Cú pháp:** \`${cmd.usage}\``,
      cmd.note ? `**Lưu ý:** ${cmd.note}` : null,
      `**Ví dụ:**\n${cmd.examples.join('\n')}`,
    ].filter(Boolean).join('\n'),
    inline: false,
  }));
  return new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle(cat.label)
    .setDescription(cat.description)
    .addFields(fields)
    .setColor(cat.color)
    .setFooter({ text: `${FOOTER_DEFAULT} • Dùng /help để quay lại tổng quan` })
    .setTimestamp();
}

function buildSelectMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('help_category')
      .setPlaceholder('Chọn danh mục...')
      .addOptions(
        { label: 'Tổng quan', description: 'Xem tất cả danh mục', value: 'overview', emoji: '📖' },
        ...Object.entries(CATEGORIES).map(([key, cat]) => ({
          label: cat.label.replace(/^[^ ]+ /, ''),
          description: cat.description,
          value: key,
          emoji: cat.label.split(' ')[0],
        }))
      )
  );
}

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const embed = buildOverviewEmbed();
  const menu  = buildSelectMenu();
  await interaction.editReply({ embeds: [embed], components: [menu] });
}

// Xử lý select menu — gọi từ interactionCreate
async function handleSelectMenu(interaction) {
  if (interaction.customId !== 'help_category') return false;
  await interaction.deferUpdate();
  const val = interaction.values[0];
  const embed = val === 'overview' ? buildOverviewEmbed() : buildCategoryEmbed(val);
  if (!embed) return false;
  await interaction.editReply({ embeds: [embed], components: [buildSelectMenu()] });
  return true;
}

module.exports = { data, execute, handleSelectMenu };
