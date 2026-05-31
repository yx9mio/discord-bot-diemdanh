// commands/sua.js — L4: sửa điểm danh phiên đã đóng
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { laAdmin } = require('../utils/helpers.js');

const data = new SlashCommandBuilder()
  .setName('sua_diemdanh')
  .setDescription('Sửa điểm danh của thành viên trong phiên đã đóng')
  .addStringOption(o => o.setName('session_id').setDescription('ID phiên (lấy từ /lich_su)').setRequired(true))
  .addUserOption(o => o.setName('thanh_vien').setDescription('Thành viên cần sửa').setRequired(true))
  .addStringOption(o =>
    o.setName('trang_thai')
      .setDescription('Trạng thái mới')
      .setRequired(true)
      .addChoices(
        { name: '✅ Tham Gia',    value: 'tham_gia' },
        { name: '⏰ Đến Trễ',   value: 'tre' },
        { name: '❌ Vắng Mặt',  value: 'khong_tham_gia' },
        { name: '🗑️ Xóa khỏi phiên', value: 'remove' },
      )
  );

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  const cfg   = await db.getConfig(guild.id);

  if (!laAdmin(interaction.member, cfg)) {
    return interaction.editReply({ content: '🔒 Bạn không có quyền thực hiện lệnh này.' });
  }

  const sessionId = interaction.options.getString('session_id');
  const target    = interaction.options.getUser('thanh_vien');
  const status    = interaction.options.getString('trang_thai');

  const session = await db.getSessionById(sessionId, guild.id);
  if (!session) {
    return interaction.editReply({ content: '⚠️ Không tìm thấy phiên này. Kiểm tra lại ID.' });
  }
  if (session.is_active) {
    return interaction.editReply({ content: '⚠️ Phiên đang mở. Dùng /them_diemdanh hoặc /xoa_diemdanh thay thế.' });
  }

  const member = await guild.members.fetch(target.id).catch(() => null);
  const displayName = member?.displayName ?? target.username;

  if (status === 'remove') {
    await db.removeAttendance(sessionId, target.id);
  } else {
    // upsertAttendanceNoTime — không đổi checked_in_at gốc
    await db.upsertAttendanceNoTime(sessionId, guild.id, target.id, displayName, status);
  }

  // Tính lại toàn bộ stats của member đó
  await db.recalculateMemberStats(guild.id, target.id);

  const labelMap = { tham_gia: '✅ Tham Gia', tre: '⏰ Đến Trễ', khong_tham_gia: '❌ Vắng Mặt', remove: '🗑️ đã xóa' };
  await interaction.editReply({
    content: `✅ Đã cập nhật **${displayName}** trong phiên **${session.session_name}** — ${labelMap[status]}. Stats đã được tính lại.`,
  });
}

module.exports = { data, execute };
