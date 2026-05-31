// commands/setup.js — Wizard thiết lập đầy đủ: role, phái, lịch cố định
const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  PermissionFlagsBits,
} = require('discord.js');
const db = require('../db.js');
const { FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('../utils/embeds.js');
const { timKenhThongBao } = require('../utils/helpers.js');

// ── Dữ liệu dùng chung ──────────────────────────────────────────────────────
const TEN_THU = ['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
const THU_MAP = {
  'cn': 0, 'chu_nhat': 0,
  't2': 1, 'thu_hai': 1,
  't3': 2, 'thu_ba': 2,
  't4': 3, 'thu_tu': 3,
  't5': 4, 'thu_nam': 4,
  't6': 5, 'thu_sau': 5,
  't7': 6, 'thu_bay': 6,
};
const THU_CHOICES = [
  { name: 'Chủ nhật (CN)', value: '0' },
  { name: 'Thứ hai (T2)',   value: '1' },
  { name: 'Thứ ba (T3)',    value: '2' },
  { name: 'Thứ tư (T4)',    value: '3' },
  { name: 'Thứ năm (T5)',   value: '4' },
  { name: 'Thứ sáu (T6)',   value: '5' },
  { name: 'Thứ bảy (T7)',   value: '6' },
];

const pad = n => String(n ?? 0).padStart(2, '0');

// Lịch mặc định: mở T7 21:00, đóng T7 19:30 tuần sau
const LICH_MAC_DINH = [
  { ten: 'Bang Chiến', thuMo: 6, gioMo: 21, phutMo: 0, thuDong: 6, gioDong: 19, phutDong: 30 },
];

// ── Slash command ─────────────────────────────────────────────────────────────
const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Wizard thiết lập đầy đủ: role, phái và lịch cố định mặc định')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(s =>
    s.setName('xem').setDescription('Xem tổng quan cấu hình hiện tại'))
  .addSubcommand(s =>
    s.setName('role')
      .setDescription('Cài role điểm danh và role admin bot')
      .addRoleOption(o => o.setName('role').setDescription('Role được điểm danh').setRequired(true))
      .addRoleOption(o => o.setName('admin_role').setDescription('Role quản lý bot').setRequired(true)))
  .addSubcommand(s => {
    s.setName('phai').setDescription('Cài danh sách role phái cho server');
    for (let i = 1; i <= 11; i++)
      s.addRoleOption(o => o.setName(`phai_${i}`).setDescription(`Phái ${i}`).setRequired(i === 1));
    return s;
  })
  .addSubcommand(s =>
    s.setName('lich')
      .setDescription('Thêm lịch điểm danh cố định hằng tuần')
      .addStringOption(o => o.setName('ten').setDescription('Tên phiên (vd: Bang Chiến)').setRequired(true))
      .addStringOption(o => o.setName('thu_mo')
        .setDescription('Thứ Mở').setRequired(true)
        .addChoices(...THU_CHOICES))
      .addIntegerOption(o => o.setName('gio_mo').setDescription('Giờ Mở (giờ VN, 0-23)').setRequired(true).setMinValue(0).setMaxValue(23))
      .addIntegerOption(o => o.setName('phut_mo').setDescription('Phút Mở (0-59)').setRequired(true).setMinValue(0).setMaxValue(59))
      .addStringOption(o => o.setName('thu_dong')
        .setDescription('Thứ Đóng (tuần sau nếu trùng/trước giờ mở)')
        .addChoices(...THU_CHOICES))
      .addIntegerOption(o => o.setName('gio_dong').setDescription('Giờ Đóng (0-23)').setMinValue(0).setMaxValue(23))
      .addIntegerOption(o => o.setName('phut_dong').setDescription('Phút Đóng (0-59)').setMinValue(0).setMaxValue(59))
      .addChannelOption(o => o.setName('kenh').setDescription('Kênh gửi thông báo (mặc định kênh hiện tại)')))
  // ⚡ Preset: mở T7 21:00 → đóng T7 19:30 tuần sau
  .addSubcommand(s =>
    s.setName('preset_bang_chien')
      .setDescription('⚡ Tạo nhanh lịch Bang Chiến: mở Thứ bảy 21:00 → đóng Thứ bảy 19:30 tuần sau')
      .addChannelOption(o => o.setName('kenh').setDescription('Kênh gửi thông báo (mặc định kênh hiện tại)')));

// ── Hàm phụ: build embed tổng quan ──────────────────────────────────────────
async function buildOverviewEmbed(guild, cfg) {
  const notifChannel = await timKenhThongBao(guild);
  const daCaiDat = !!(cfg.allowed_role_id || cfg.admin_role_id || cfg.phai_role_ids?.length);

  const lichList = await db.getLichCoDinh(guild.id);
  const lichDesc = lichList.length
    ? lichList.map((l, i) => {
        const mo   = `${TEN_THU[l.day_of_week]} ${pad(l.hour)}:${pad(l.minute)}`;
        const dong = l.close_day_of_week != null
          ? `→ ${TEN_THU[l.close_day_of_week]} ${pad(l.close_hour)}:${pad(l.close_minute)} (tuần sau)`
          : '→ _ko tự đóng_';
        return `${i+1}. **${l.session_name}** | ${mo} ${dong} | <#${l.channel_id}>`;
      }).join('\n')
    : '⚠️ Chưa có lịch cố định';

  return new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle('🛠️ Cấu Hình Bot Điểm Danh')
    .setDescription(daCaiDat
      ? '✅ Bot đã được cài đặt. Dưới đây là cấu hình hiện tại.'
      : '👋 Chưa có cấu hình! Dùng `/setup role`, `/setup phai`, `/setup lich` để bắt đầu.')
    .addFields(
      { name: '🔔 Kênh thông báo', value: notifChannel ? `<#${notifChannel}>` : '_Chưa rõ_', inline: true },
      { name: '🔑 Role điểm danh', value: cfg.allowed_role_id ? `<@&${cfg.allowed_role_id}>` : '⚠️ Chưa cài', inline: true },
      { name: '🛡️ Role admin bot', value: cfg.admin_role_id ? `<@&${cfg.admin_role_id}>` : '⚠️ Chưa cài', inline: true },
      {
        name: `🏆 Phái (${cfg.phai_role_ids?.length ?? 0})`,
        value: cfg.phai_role_ids?.length
          ? cfg.phai_role_ids.map(id => `<@&${id}>`).join(' ')
          : '⚠️ Chưa cài phái',
        inline: false,
      },
      { name: `📅 Lịch cố định (${lichList.length})`, value: lichDesc, inline: false },
    )
    .setColor(daCaiDat ? 0x57F287 : 0xFEE75C)
    .setFooter({ text: `${FOOTER_DEFAULT} • /setup xem để kiểm tra lại` })
    .setTimestamp();
}

// ── Hàm phụ: build embed hướng dẫn bước tiếp theo ──────────────────────────
function buildGuideEmbed(cfg) {
  const steps = [];

  if (!cfg.allowed_role_id || !cfg.admin_role_id)
    steps.push('**[Cần làm]** `/setup role role:@... admin_role:@...` — cài role điểm danh & admin');
  else
    steps.push('✅ Role đã cài');

  if (!cfg.phai_role_ids?.length)
    steps.push('**[Cần làm]** `/setup phai phai_1:@... phai_2:@...` — cài danh sách phái');
  else
    steps.push(`✅ Phái đã cài (${cfg.phai_role_ids.length} phái)`);

  steps.push('📅 `/setup lich` — thêm lịch tự động bất kỳ');
  steps.push('⚡ `/setup preset_bang_chien` — tạo ngay lịch **Bang Chiến** Thứ bảy 21:00 → Thứ bảy 19:30 tuần sau');
  steps.push('📖 `/help` — xem tất cả lệnh');

  return new EmbedBuilder()
    .setTitle('🚀 Bước Tiếp Theo')
    .setDescription(steps.join('\n'))
    .setColor(0x5865F2)
    .setFooter({ text: FOOTER_DEFAULT });
}

// ── Hàm phụ: buttons ─────────────────────────────────────────────────────────
function buildSetupButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup_help').setLabel('📖 /help').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('setup_config').setLabel('⚙️ Cấu hình').setStyle(ButtonStyle.Secondary),
  );
}

// ── Execute ───────────────────────────────────────────────────────────────────
async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
    return interaction.editReply({ content: '🔒 Chỉ **Quản trị viên** mới có thể chạy `/setup`.' });

  const guild = interaction.guild;
  const sub   = interaction.options.getSubcommand();
  const cfg   = await db.getConfig(guild.id);

  // ── /setup xem ─────────────────────────────────────────────────────────────
  if (sub === 'xem') {
    const embed = await buildOverviewEmbed(guild, cfg);
    return interaction.editReply({ embeds: [embed, buildGuideEmbed(cfg)], components: [buildSetupButtons()] });
  }

  // ── /setup role ────────────────────────────────────────────────────────────
  if (sub === 'role') {
    const role      = interaction.options.getRole('role');
    const adminRole = interaction.options.getRole('admin_role');
    await db.setConfig(guild.id, { allowed_role_id: role.id, admin_role_id: adminRole.id });
    const cfgMoi = await db.getConfig(guild.id);
    const embed  = await buildOverviewEmbed(guild, cfgMoi);
    return interaction.editReply({
      content: `✅ Đã cài:\n• Role điểm danh: <@&${role.id}>\n• Role admin bot: <@&${adminRole.id}>`,
      embeds: [embed, buildGuideEmbed(cfgMoi)],
    });
  }

  // ── /setup phai ────────────────────────────────────────────────────────────
  if (sub === 'phai') {
    const phaiRoleIds = [];
    for (let i = 1; i <= 11; i++) {
      const r = interaction.options.getRole(`phai_${i}`);
      if (r) phaiRoleIds.push(r.id);
    }
    await db.setConfig(guild.id, { phai_role_ids: phaiRoleIds });
    const cfgMoi = await db.getConfig(guild.id);
    const list   = phaiRoleIds.map((id, i) => `${i+1}. <@&${id}>`).join('\n');
    const embed  = await buildOverviewEmbed(guild, cfgMoi);
    return interaction.editReply({
      content: `✅ Đã lưu **${phaiRoleIds.length}** phái:\n${list}`,
      embeds: [embed],
    });
  }

  // ── /setup lich ────────────────────────────────────────────────────────────
  if (sub === 'lich') {
    const ten      = interaction.options.getString('ten');
    const thuMo    = parseInt(interaction.options.getString('thu_mo'), 10);
    const gioMo    = interaction.options.getInteger('gio_mo');
    const phutMo   = interaction.options.getInteger('phut_mo');
    const kenh     = interaction.options.getChannel('kenh') ?? interaction.channel;
    const thuDongRaw = interaction.options.getString('thu_dong');
    const thuDong  = thuDongRaw != null ? parseInt(thuDongRaw, 10) : null;
    const gioDong  = interaction.options.getInteger('gio_dong')  ?? null;
    const phutDong = interaction.options.getInteger('phut_dong') ?? null;
    const phaiRoleIds = cfg.phai_role_ids ?? [];

    const lich = await db.themLichCoDinh(guild.id, {
      dayOfWeek: thuMo, hour: gioMo, minute: phutMo,
      sessionName: ten,
      closeDayOfWeek: thuDong, closeHour: gioDong, closeMinute: phutDong,
      phaiRoleIds,
      channelId: kenh.id,
    });

    const { scheduleLichCoDinh } = require('../utils/scheduler.js');
    await scheduleLichCoDinh(interaction.client, guild, lich);

    const moStr   = `${TEN_THU[thuMo]} ${pad(gioMo)}:${pad(phutMo)}`;
    const dongStr = thuDong != null
      ? `${TEN_THU[thuDong]} ${pad(gioDong)}:${pad(phutDong)}`
      : '_không tự đóng_';
    const phaiStr = phaiRoleIds.length
      ? phaiRoleIds.map(id => `<@&${id}>`).join(', ')
      : '_chưa cài phái_';

    const cfgMoi = await db.getConfig(guild.id);
    const embed  = await buildOverviewEmbed(guild, cfgMoi);
    return interaction.editReply({
      content: [
        `✅ Đã thêm & lên lịch cố định:`,
        `**${ten}** | Mở: **${moStr}** → Đóng: **${dongStr}**`,
        `Kênh: <#${kenh.id}> | Phái: ${phaiStr}`,
        `ID: \`${lich.id}\``,
      ].join('\n'),
      embeds: [embed],
    });
  }

  // ── /setup preset_bang_chien ───────────────────────────────────────────────
  if (sub === 'preset_bang_chien') {
    const kenh = interaction.options.getChannel('kenh') ?? interaction.channel;
    const phaiRoleIds = cfg.phai_role_ids ?? [];
    const preset = LICH_MAC_DINH[0]; // T7 21:00 → T7 19:30 tuần sau

    const lich = await db.themLichCoDinh(guild.id, {
      dayOfWeek:      preset.thuMo,
      hour:           preset.gioMo,
      minute:         preset.phutMo,
      sessionName:    preset.ten,
      closeDayOfWeek: preset.thuDong,
      closeHour:      preset.gioDong,
      closeMinute:    preset.phutDong,
      phaiRoleIds,
      channelId: kenh.id,
    });

    const { scheduleLichCoDinh } = require('../utils/scheduler.js');
    await scheduleLichCoDinh(interaction.client, guild, lich);

    const cfgMoi = await db.getConfig(guild.id);
    const embed  = await buildOverviewEmbed(guild, cfgMoi);
    return interaction.editReply({
      content: [
        `⚡ Đã tạo preset **Bang Chiến**:`,
        `Mở: **Thứ bảy 21:00** → Đóng: **Thứ bảy 19:30 tuần sau** | Kênh: <#${kenh.id}>`,
        phaiRoleIds.length
          ? `Phái (${phaiRoleIds.length}): ${phaiRoleIds.map(id => `<@&${id}>`).join(', ')}`
          : '⚠️ Chưa cài phái — chạy `/setup phai` trước',
        `ID: \`${lich.id}\``,
      ].join('\n'),
      embeds: [embed],
    });
  }
}

module.exports = { data, execute };
