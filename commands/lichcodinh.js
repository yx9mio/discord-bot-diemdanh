// commands/lichcodinh.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db  = require('../db.js');
const { laAdmin } = require('../utils/helpers.js');
const { FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('../utils/embeds.js');

const TEN_THU = ['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
const pad = n => String(n ?? 0).padStart(2, '0');

const THU_CHOICES = [
  { name: 'Thứ 2', value: 1 }, { name: 'Thứ 3', value: 2 }, { name: 'Thứ 4', value: 3 },
  { name: 'Thứ 5', value: 4 }, { name: 'Thứ 6', value: 5 }, { name: 'Thứ 7', value: 6 },
  { name: 'Chủ Nhật', value: 0 },
];

const data = new SlashCommandBuilder()
  .setName('lich_co_dinh')
  .setDescription('Quản lý lịch điểm danh cố định hằng tuần')
  .addSubcommand(s =>
    s.setName('them')
      .setDescription('Thêm lịch điểm danh cố định')
      .addIntegerOption(o => o.setName('thu_mo').setDescription('Thứ MỞ phiên').setRequired(true).addChoices(...THU_CHOICES))
      .addIntegerOption(o => o.setName('gio_mo').setDescription('Giờ MỞ (0-23, giờ VN)').setRequired(true).setMinValue(0).setMaxValue(23))
      .addIntegerOption(o => o.setName('phut_mo').setDescription('Phút MỞ (0-59)').setRequired(true).setMinValue(0).setMaxValue(59))
      .addStringOption(o => o.setName('ten').setDescription('Tên phiên (vd: Bang Chiến)').setRequired(true))
      .addIntegerOption(o => o.setName('thu_dong').setDescription('Thứ ĐÓNG phiên').addChoices(...THU_CHOICES))
      .addIntegerOption(o => o.setName('gio_dong').setDescription('Giờ ĐÓNG (0-23)').setMinValue(0).setMaxValue(23))
      .addIntegerOption(o => o.setName('phut_dong').setDescription('Phút ĐÓNG (0-59)').setMinValue(0).setMaxValue(59))
      // 11 phái
      .addRoleOption(o => o.setName('phai_1').setDescription('Phái 1 (vd: Thiết Y)'))
      .addRoleOption(o => o.setName('phai_2').setDescription('Phái 2 (vd: Huyết Hà)'))
      .addRoleOption(o => o.setName('phai_3').setDescription('Phái 3 (vd: Tố Vấn)'))
      .addRoleOption(o => o.setName('phai_4').setDescription('Phái 4 (vd: Cửu Linh)'))
      .addRoleOption(o => o.setName('phai_5').setDescription('Phái 5 (vd: Toái Mộng)'))
      .addRoleOption(o => o.setName('phai_6').setDescription('Phái 6 (vd: Long Ngâm)'))
      .addRoleOption(o => o.setName('phai_7').setDescription('Phái 7 (vd: Thần Tương)'))
      .addRoleOption(o => o.setName('phai_8').setDescription('Phái 8 (vd: Thương Lan)'))
      .addRoleOption(o => o.setName('phai_9').setDescription('Phái 9 (vd: Triều Quang)'))
      .addRoleOption(o => o.setName('phai_10').setDescription('Phái 10 (vd: Huyền Cơ)'))
      .addRoleOption(o => o.setName('phai_11').setDescription('Phái 11 (vd: Hồng Âm)'))
      .addChannelOption(o => o.setName('kenh').setDescription('Kênh gửi thông báo (mặc định kênh hiện tại)'))
  )
  .addSubcommand(s =>
    s.setName('xoa')
      .setDescription('Xóa lịch cố định')
      .addStringOption(o => o.setName('id').setDescription('ID lịch (/lich_co_dinh xem để lấy)').setRequired(true))
  )
  .addSubcommand(s => s.setName('xem').setDescription('Xem danh sách lịch cố định'));

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  const cfg   = await db.getConfig(guild.id);
  const sub   = interaction.options.getSubcommand();

  // ── Xem ─────────────────────────────────────────────────────────────────
  if (sub === 'xem') {
    const list = await db.getLichCoDinh(guild.id);
    if (!list.length) return interaction.editReply({ content: '📭 Chưa có lịch cố định nào.' });
    const desc = list.map((l, i) => {
      const mo   = `${TEN_THU[l.day_of_week]} **${pad(l.hour)}:${pad(l.minute)}**`;
      const dong = l.close_day_of_week != null
        ? `→ đóng ${TEN_THU[l.close_day_of_week]} **${pad(l.close_hour)}:${pad(l.close_minute)}**`
        : '→ _không tự đóng_';
      const phai = l.phai_role_ids?.length
        ? l.phai_role_ids.map(id => `<@&${id}>`).join(', ')
        : '_theo role cao nhất_';
      const kenh = l.channel_id ? `<#${l.channel_id}>` : 'không rõ';
      return `**${i+1}.** \`${l.id.slice(0,8)}\` — **${l.session_name}**\n└ ${mo} ${dong} | Kênh: ${kenh}\n└ Phái (${l.phai_role_ids?.length ?? 0}): ${phai}`;
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

  if (!laAdmin(interaction.member, cfg))
    return interaction.editReply({ content: '🔒 Bạn không có quyền.' });

  // ── Thêm ──────────────────────────────────────────────────────────────────
  if (sub === 'them') {
    const thuMo    = interaction.options.getInteger('thu_mo');
    const gioMo    = interaction.options.getInteger('gio_mo');
    const phutMo   = interaction.options.getInteger('phut_mo');
    const ten      = interaction.options.getString('ten');
    const kenh     = interaction.options.getChannel('kenh') ?? interaction.channel;
    const thuDong  = interaction.options.getInteger('thu_dong')  ?? null;
    const gioDong  = interaction.options.getInteger('gio_dong')  ?? null;
    const phutDong = interaction.options.getInteger('phut_dong') ?? null;

    const phaiRoleIds = [];
    for (let i = 1; i <= 11; i++) {
      const r = interaction.options.getRole(`phai_${i}`);
      if (r) phaiRoleIds.push(r.id);
    }

    const lich = await db.themLichCoDinh(guild.id, {
      dayOfWeek: thuMo, hour: gioMo, minute: phutMo,
      sessionName: ten,
      closeDayOfWeek: thuDong, closeHour: gioDong, closeMinute: phutDong,
      phaiRoleIds,
      channelId: kenh.id,
    });

    const moStr   = `${TEN_THU[thuMo]} ${pad(gioMo)}:${pad(phutMo)}`;
    const dongStr = thuDong != null ? `${TEN_THU[thuDong]} ${pad(gioDong)}:${pad(phutDong)}` : '_không tự đóng_';
    const phaiStr = phaiRoleIds.length ? phaiRoleIds.map(id => `<@&${id}>`).join(', ') : '_theo role cao nhất_';

    return interaction.editReply({
      content: [
        `✅ Đã thêm lịch cố định:`,
        `**${ten}** | Mở: **${moStr}** → Đóng: **${dongStr}**`,
        `Kênh: <#${kenh.id}> | Phái (${phaiRoleIds.length}): ${phaiStr}`,
        `ID: \`${lich.id}\``,
      ].join('\n'),
    });

  // ── Xóa ───────────────────────────────────────────────────────────────────
  } else if (sub === 'xoa') {
    const id = interaction.options.getString('id');
    const ok = await db.xoaLichCoDinh(guild.id, id);
    if (!ok) return interaction.editReply({ content: `⚠️ Không tìm thấy lịch \`${id}\`.` });
    const { cancelLichCoDinh } = require('../utils/scheduler.js');
    cancelLichCoDinh(guild.id, id);
    return interaction.editReply({ content: `🗑️ Đã xóa lịch \`${id.slice(0,8)}\`.` });
  }
}

module.exports = { data, execute };
