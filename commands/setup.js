// commands/setup.js — Wizard thiết lập mặc định khi thêm bot vào server
const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  PermissionFlagsBits,
} = require('discord.js');
const db = require('../db.js');
const { FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('../utils/embeds.js');
const { timKenhThongBao } = require('../utils/helpers.js');

const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Thiết lập cấu hình mặc định khi thêm bot vào server')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  // Chỉ Administrator mới chạy được
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.editReply({ content: '🔒 Chỉ **Quản trị viên** mới có thể chạy `/setup`.' });
  }

  const guild = interaction.guild;
  const cfg   = await db.getConfig(guild.id);

  // Lấy thông tin thực tế của server
  await guild.members.fetch().catch(() => null);
  const totalMembers  = guild.memberCount;
  const botCount      = guild.members.cache.filter(m => m.user.bot).size;
  const humanCount    = totalMembers - botCount;
  const channelId     = interaction.channelId;
  const notifChannel  = await timKenhThongBao(guild);

  // Kiểm tra đã cài chưa
  const daCaiDat = !!cfg.allowed_role_id || !!cfg.admin_role_id || (cfg.phai_role_ids?.length > 0);

  // Build embed tổng quan
  const fields = [
    {
      name: '👥 Thành viên',
      value: `**${humanCount}** người (${botCount} bot)`,
      inline: true,
    },
    {
      name: '💬 Kênh hiện tại',
      value: `<#${channelId}>`,
      inline: true,
    },
    {
      name: '🔔 Kênh thông báo',
      value: notifChannel ? `<#${notifChannel}>` : 'Chưa tìm thấy',
      inline: true,
    },
    {
      name: '🔑 Role điểm danh hiện tại',
      value: cfg.allowed_role_id ? `<@&${cfg.allowed_role_id}>` : '⚠️ Chưa cài — **tất cả thành viên** đều điểm danh được',
      inline: false,
    },
    {
      name: '🛡️ Role admin bot hiện tại',
      value: cfg.admin_role_id ? `<@&${cfg.admin_role_id}>` : '⚠️ Chưa cài — chỉ **Administrator** mới dùng được',
      inline: false,
    },
    {
      name: '🏆 Phái đã cài',
      value: cfg.phai_role_ids?.length > 0
        ? cfg.phai_role_ids.map(id => `<@&${id}>`).join(' ')
        : '⚠️ Chưa cài phái',
      inline: false,
    },
  ];

  const embed = new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle('🛠️ Thiết Lập Bot Điểm Danh')
    .setDescription(
      daCaiDat
        ? '✅ Bot đã được cài đặt trước đó. Dưới đây là **cấu hình hiện tại** của server.'
        : '👋 Chưa có cấu hình nào! Hãy dùng các lệnh bên dưới để thiết lập.'
    )
    .addFields(fields)
    .setColor(daCaiDat ? 0x57F287 : 0xFEE75C)
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  // Hướng dẫn tiếp theo
  const guide = new EmbedBuilder()
    .setTitle('🚀 Hướng Dẫn Thiết Lập Nhanh')
    .setDescription(
      [
        '**Bước 1** — Cài role (bắt buộc)',
        '> `/cai_dat role role:@TenRole` — ai được điểm danh',
        '> `/cai_dat admin_role role:@TenRole` — ai quản lý bot',
        '',
        '**Bước 2** — Cài phái (nếu có)',
        '> `/cai_dat_phai phai_1:@Role1 phai_2:@Role2 ...`',
        '> Chạy **1 lần duy nhất**, tự động áp dụng cho lịch cố định',
        '',
        '**Bước 3** — Tạo lịch tự động (tùy chọn)',
        '> `/lich_co_dinh them ten:... thu_mo:... gio_mo:... phut_mo:...`',
        '',
        '**Bước 4** — Mở phiên thủ công (tùy chọn)',
        '> `/bat_dau ten:Tên phiên`',
        '',
        '📖 Gõ `/help` để xem tất cả lệnh.',
      ].join('\n')
    )
    .setColor(0x5865F2)
    .setFooter({ text: `${FOOTER_DEFAULT} • /cai_dat xem để kiểm tra lại bất kỳ lúc nào` });

  // Button shortcuts
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup_help')
      .setLabel('📖 Xem /help')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('setup_config')
      .setLabel('⚙️ Xem cấu hình')
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.editReply({ embeds: [embed, guide], components: [row] });
}

module.exports = { data, execute };
