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
      .addStringOption(o => o.setName('ten').setDescription('Tên phiên (vd: Bang Chiến)').setRequired(true))
      .addIntegerOption(o => o.setName('thu_mo').setDescription('Thứ Mở phiên').setRequired(true).addChoices(...THU_CHOICES))
      .addIntegerOption(o => o.setName('gio_mo').setDescription('Giờ Mở (0-23, giờ VN)').setRequired(true).setMinValue(0).setMaxValue(23))
      .addIntegerOption(o => o.setName('phut_mo').setDescription('Phút Mở (0-59)').setRequired(true).setMinValue(0).setMaxValue(59))
      .addIntegerOption(o => o.setName('thu_dong').setDescription('Thứ ĐÓNG phiên').addChoices(...THU_CHOICES))
      .addIntegerOption(o => o.setName('gio_dong').setDescription('Giờ ĐÓNG (0-23)').setMinValue(0).setMaxValue(23))
      .addIntegerOption(o => o.setName('phut_dong').setDescription('Phút ĐÓNG (0-59)').setMinValue(0).setMaxValue(59))
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

  // ── Xem ──────────────────────────────────────────────────────────────────
  if (sub === 'xem') {
    const list = await db.getLichCoDinh(guild.id);
    if (!list.length) return interaction.editReply({ content: '📭 Chưa có lịch cố định nào.' });
    const phaiServer = cfg.phai_role_ids ?? [];
    const desc = list.map((l, i) => {
      const mo   = `${TEN_THU[l.day_of_week]} **${pad(l.hour)}:${pad(l.minute)}**`;
      const dong = l.close_day_of_week != null
        ? `→ đóng ${TEN_THU[l.close_day_of_week]} **${pad(l.close_hour)}:${pad(l.close_minute)}**`
        : '→ _không tự đóng_';
      const phaiIds = phaiServer.length ? phaiServer : (l.phai_role_ids ?? []);
      const phai = phaiIds.length ? phaiIds.map(id => `<@&${id}>`).join(', ') : '_theo role cao nhất_';
      const kenh = l.channel_id ? `<#${l.channel_id}>` : 'không rõ';
      return `**${i+1}.** \`${l.id.slice(0,8)}\` — **${l.session_name}**\n└ ${mo} ${dong} | Kênh: ${kenh}\n└ Phái: ${phai}`;
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

  // ── Thêm ─────────────────────────────────────────────────────────────────
  if (sub === 'them') {
    const ten      = interaction.options.getString('ten');
    const thuMo    = interaction.options.getInteger('thu_mo');
    const gioMo    = interaction.options.getInteger('gio_mo');
    const phutMo   = interaction.options.getInteger('phut_mo');
    const kenh     = interaction.options.getChannel('kenh') ?? interaction.channel;
    const thuDong  = interaction.options.getInteger('thu_dong')  ?? null;
    const gioDong  = interaction.options.getInteger('gio_dong')  ?? null;
    const phutDong = interaction.options.getInteger('phut_dong') ?? null;

    // Dùng phai từ guild_config (đã cài qua /cai_dat_phai)
    const phaiRoleIds = cfg.phai_role_ids ?? [];

    const lich = await db.themLichCoDinh(guild.id, {
      dayOfWeek: thuMo, hour: gioMo, minute: phutMo,
      sessionName: ten,
      closeDayOfWeek: thuDong, closeHour: gioDong, closeMinute: phutDong,
      phaiRoleIds,
      channelId: kenh.id,
    });

    // BUG RUNTIME FIX: truyền guild.id (string) thay vì guild (object)
    const { scheduleLichCoDinh } = require('../utils/scheduler.js');
    await scheduleLichCoDinh(interaction.client, guild.id, lich);

    const moStr   = `${TEN_THU[thuMo]} ${pad(gioMo)}:${pad(phutMo)}`;
    const dongStr = thuDong != null
      ? `${TEN_THU[thuDong]} ${pad(gioDong)}:${pad(phutDong)}`
      : '_không tự đóng_';
    const phaiStr = phaiRoleIds.length
      ? phaiRoleIds.map(id => `<@&${id}>`).join(', ')
      : '_chưa cài phái — dùng /cai_dat_phai_';

    return interaction.editReply({
      content: [
        `✅ Đã thêm & lên lịch cố định:`,
        `**${ten}** | Mở: **${moStr}** → Đóng: **${dongStr}**`,
        `Kênh: <#${kenh.id}> | Phái (${phaiRoleIds.length}): ${phaiStr}`,
        `ID: \`${lich.id}\``,
      ].join('\n'),
    });

  // ── Xóa ──────────────────────────────────────────────────────────────────
  } else if (sub === 'xoa') {
    const id = interaction.options.getString('id');
    const ok = await db.xoaLichCoDinh(guild.id, id);
    if (!ok) return interaction.editReply({ content: `⚠️ Không tìm thấy lịch \`${id}\`.` });
    const { cancelLichCoDinh } = require('../utils/scheduler.js');
    cancelLichCoDinh(guild.id, id);
    return interaction.editReply({ content: `🗑️ Đã xóa & hủy lịch \`${id.slice(0,8)}\`.` });
  }
}

module.exports = { data, execute };
