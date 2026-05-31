// commands/lichcodinh.js — Quản lý lịch điểm danh cố định (bang chiến, v.v.)
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db  = require('../db.js');
const { laAdmin } = require('../utils/helpers.js');
const { FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('../utils/embeds.js');

const TEN_THU = ['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];

const data = new SlashCommandBuilder()
  .setName('lich_co_dinh')
  .setDescription('Quản lý lịch điểm danh cố định hằng tuần')
  .addSubcommand(s =>
    s.setName('them')
      .setDescription('Thêm lịch điểm danh cố định')
      .addIntegerOption(o => o.setName('thu').setDescription('Thứ trong tuần').setRequired(true)
        .addChoices(
          { name: 'Thứ 2', value: 1 }, { name: 'Thứ 3', value: 2 }, { name: 'Thứ 4', value: 3 },
          { name: 'Thứ 5', value: 4 }, { name: 'Thứ 6', value: 5 }, { name: 'Thứ 7', value: 6 },
          { name: 'Chủ Nhật', value: 0 },
        ))
      .addIntegerOption(o => o.setName('gio').setDescription('Giờ (0-23, giờ VN)').setRequired(true).setMinValue(0).setMaxValue(23))
      .addIntegerOption(o => o.setName('phut').setDescription('Phút (0-59)').setRequired(true).setMinValue(0).setMaxValue(59))
      .addStringOption(o => o.setName('ten').setDescription('Tên phiên (vd: Bang Chiến)').setRequired(true))
      .addIntegerOption(o => o.setName('thoi_gian_dong').setDescription('Tự đóng sau X phút (mặc định 60)').setMinValue(1).setMaxValue(1440))
      .addChannelOption(o => o.setName('kenh').setDescription('Kênh gửi thông báo (mặc định kênh hiện tại)'))
  )
  .addSubcommand(s =>
    s.setName('xoa')
      .setDescription('Xóa lịch điểm danh cố định')
      .addStringOption(o => o.setName('id').setDescription('ID lịch (lấy từ /lich_co_dinh xem)').setRequired(true))
  )
  .addSubcommand(s => s.setName('xem').setDescription('Xem danh sách lịch cố định đang hoạt động'));

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  const cfg   = await db.getConfig(guild.id);
  const sub   = interaction.options.getSubcommand();

  // Xem — ai cũng xem được
  if (sub === 'xem') {
    const list = await db.getLichCoDinh(guild.id);
    if (!list.length) {
      return interaction.editReply({ content: '📭 Chưa có lịch điểm danh cố định nào.' });
    }
    const desc = list.map((l, i) => {
      const ten = TEN_THU[l.day_of_week];
      const gio = String(l.hour).padStart(2, '0');
      const pht = String(l.minute).padStart(2, '0');
      const kenh = l.channel_id ? `<#${l.channel_id}>` : 'không rõ';
      return `**${i + 1}.** \`${l.id.slice(0, 8)}\` — **${l.session_name}**\n└ ${ten} **${gio}:${pht}** | Đóng sau **${l.duration_minutes}p** | Kênh: ${kenh}`;
    }).join('\n\n');

    const embed = new EmbedBuilder()
      .setAuthor(AUTHOR_DEFAULT)
      .setTitle('📅 Lịch Điểm Danh Cố Định')
      .setDescription(desc)
      .setColor(0x5865F2)
      .setFooter({ text: FOOTER_DEFAULT })
      .setTimestamp();
    return interaction.editReply({ embeds: [embed] });
  }

  if (!laAdmin(interaction.member, cfg)) {
    return interaction.editReply({ content: '🔒 Bạn không có quyền thực hiện lệnh này.' });
  }

  if (sub === 'them') {
    const thu       = interaction.options.getInteger('thu');
    const gio       = interaction.options.getInteger('gio');
    const phut      = interaction.options.getInteger('phut');
    const ten       = interaction.options.getString('ten');
    const dongSau   = interaction.options.getInteger('thoi_gian_dong') ?? 60;
    const kenh      = interaction.options.getChannel('kenh') ?? interaction.channel;

    const lich = await db.themLichCoDinh(guild.id, {
      dayOfWeek: thu, hour: gio, minute: phut,
      sessionName: ten, durationMinutes: dongSau,
      channelId: kenh.id,
    });

    const tenThu = TEN_THU[thu];
    const thoiGian = `${String(gio).padStart(2,'0')}:${String(phut).padStart(2,'0')}`;
    await interaction.editReply({
      content: `✅ Đã thêm lịch cố định:\n**${ten}** — ${tenThu} lúc **${thoiGian}** | Tự đóng sau **${dongSau} phút** | Kênh: <#${kenh.id}>\n\nID: \`${lich.id}\``,
    });

    // Lên lịch cho guild này ngay
    const { scheduleLichCoDinh } = require('../utils/scheduler.js');
    await scheduleLichCoDinh(interaction.client, guild, lich);

  } else if (sub === 'xoa') {
    const id = interaction.options.getString('id');
    const ok = await db.xoaLichCoDinh(guild.id, id);
    if (!ok) return interaction.editReply({ content: '⚠️ Không tìm thấy lịch với ID này.' });

    const { cancelLichCoDinh } = require('../utils/scheduler.js');
    cancelLichCoDinh(guild.id, id);
    await interaction.editReply({ content: `🗑️ Đã xóa lịch \`${id.slice(0,8)}\`.` });
  }
}

module.exports = { data, execute };
