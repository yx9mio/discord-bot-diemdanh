// commands/batdau.js
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { buildSessionEmbed, buildAttendanceButtons } = require('../utils/embeds.js');
const { laAdmin, msDenGioVN, formatThoiGian } = require('../utils/helpers.js');
const { datHenGioDong } = require('../utils/timers.js');

const data = new SlashCommandBuilder()
  .setName('bat_dau')
  .setDescription('Mở phiên điểm danh mới')
  .addStringOption(o => o.setName('ten').setDescription('Tên phiên').setRequired(true))
  .addIntegerOption(o => o.setName('phut').setDescription('Tự đóng sau X phút (0 = không tự đóng)').setMinValue(0).setMaxValue(1440))
  .addIntegerOption(o => o.setName('gio_dong').setDescription('Giờ tự đóng (VN, 0-23)'))
  .addIntegerOption(o => o.setName('phut_dong').setDescription('Phút tự đóng (0-59)').setMinValue(0).setMaxValue(59))
  .addIntegerOption(o => o.setName('ngay_dong').setDescription('Ngày tự đóng (1-31, mặc định hôm nay)').setMinValue(1).setMaxValue(31));

async function execute(interaction) {
  // Fix: defer public (phiên mở cần ai cũng thấy), lỗi quyền reply ephemeral riêng
  await interaction.deferReply();
  const guild = interaction.guild;
  const cfg   = await db.getConfig(guild.id);

  if (!laAdmin(interaction.member, cfg)) {
    return interaction.editReply({ content: '🔒 Bạn không có quyền thực hiện lệnh này.' });
  }

  const existing = await db.getActiveSession(guild.id);
  if (existing) {
    return interaction.editReply({ content: `⚠️ Đang có phiên **${existing.session_name}** chưa kết thúc.` });
  }

  const tenPhien = interaction.options.getString('ten');
  const phut     = interaction.options.getInteger('phut')   ?? null;
  const gioDong  = interaction.options.getInteger('gio_dong')  ?? null;
  const phutDong = interaction.options.getInteger('phut_dong') ?? null;
  const ngayDong = interaction.options.getInteger('ngay_dong') ?? null;

  await guild.members.fetch();
  let eligibleMembers;
  if (cfg.allowed_role_id) {
    const role = guild.roles.cache.get(cfg.allowed_role_id);
    eligibleMembers = role ? [...role.members.values()] : [];
  } else {
    eligibleMembers = [...guild.members.cache.filter(m => !m.user.bot).values()];
  }
  const eligibleIds = eligibleMembers.map(m => m.id);

  if (eligibleIds.length === 0) {
    const roleName = cfg.allowed_role_id
      ? (guild.roles.cache.get(cfg.allowed_role_id)?.name ?? `ID: ${cfg.allowed_role_id}`)
      : 'tất cả thành viên';
    return interaction.editReply({ content: `⚠️ Không tìm thấy thành viên hợp lệ trong role **${roleName}**.` });
  }

  let autoCloseAt = null;
  let msDelay = null;

  if (gioDong !== null && phutDong !== null) {
    const result = msDenGioVN(ngayDong, gioDong, phutDong);
    if (result.errorMsg) return interaction.editReply({ content: `⚠️ ${result.errorMsg}` });
    if (result.ms <= 0)  return interaction.editReply({ content: '⚠️ Thời điểm đóng phải ở tương lai.' });
    autoCloseAt = result.targetDate.toISOString();
    msDelay = result.ms;
  } else if (phut && phut > 0) {
    msDelay = phut * 60 * 1000;
    autoCloseAt = new Date(Date.now() + msDelay).toISOString();
  }

  const roleName = cfg.allowed_role_id
    ? (guild.roles.cache.get(cfg.allowed_role_id)?.name ?? 'Role không tìm thấy')
    : 'Tất cả';

  const session = await db.createSession(guild.id, {
    sessionName: tenPhien,
    roleName,
    allowedRoleId: cfg.allowed_role_id ?? null,
    eligibleMemberIds: eligibleIds,
    startedBy: interaction.user.id,
    autoCloseAt,
    channelId: interaction.channelId,
  });

  const embed   = await buildSessionEmbed(guild, session, []);
  const buttons = buildAttendanceButtons(false);
  const message = await interaction.editReply({ embeds: [embed], components: [buttons] });
  await db.updateSessionMessageId(session.id, message.id);

  if (msDelay) {
    await datHenGioDong(interaction.client, guild, session, interaction.channelId, msDelay);
    const info = formatThoiGian(msDelay);
    await interaction.followUp({ content: `⏱️ Phiên sẽ tự đóng sau **${info}**.`, ephemeral: true });
  }
}

module.exports = { data, execute };
