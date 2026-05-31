// handlers/buttonHandler.js
const db = require('../db.js');
const { buildSessionEmbed, buildAttendanceButtons } = require('../utils/embeds.js');

// Map status -> label để reply
const STATUS_LABEL = {
  tham_gia:        '✅ Tham Gia',
  tre:             '⏰ Đến Trễ',
  khong_tham_gia:  '❌ Vắng Mặt',
};

async function handleButton(interaction) {
  const { customId, guild, member, user, channel } = interaction;

  // ── Xem danh sách (luôn cho phép, không cần phiên mở) ───
  if (customId === 'attend_view') {
    const session = await db.getActiveSession(guild.id);
    if (!session) {
      return interaction.reply({ content: '📭 Không có phiên điểm danh nào đang mở.', ephemeral: true });
    }
    const attended = await db.getAttendances(session.id);
    const embed    = await buildSessionEmbed(guild, session, attended);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ── Điểm danh (yes / late / no) ───────────────────────
  const statusMap = {
    attend_yes:  'tham_gia',
    attend_late: 'tre',
    attend_no:   'khong_tham_gia',
  };

  if (!(customId in statusMap)) return;
  await interaction.deferReply({ ephemeral: true });

  const session = await db.getActiveSession(guild.id);
  if (!session) {
    return interaction.editReply({ content: '📭 Phiên điểm danh đã đóng.' });
  }

  const cfg = await db.getConfig(guild.id);

  // Kiểm tra eligible
  if (!session.eligible_member_ids.includes(user.id)) {
    return interaction.editReply({ content: '🔒 Bạn không nằm trong danh sách điểm danh của phiên này.' });
  }

  // Kiểm tra role (nếu có cấu hình)
  if (cfg.allowed_role_id && !member.roles.cache.has(cfg.allowed_role_id)) {
    return interaction.editReply({ content: '🔒 Bạn không có quyền điểm danh trong phiên này.' });
  }

  const status      = statusMap[customId];
  const displayName = member.displayName ?? user.username;
  await db.upsertAttendance(session.id, guild.id, user.id, displayName, status);

  await interaction.editReply({
    content: `✅ Đã ghi nhận: **${displayName}** — ${STATUS_LABEL[status]}.`,
  });

  // Cập nhật embed gốc
  try {
    if (session.message_id) {
      const msg = await channel.messages.fetch(session.message_id).catch(() => null);
      if (msg) {
        const attended = await db.getAttendances(session.id);
        const embed    = await buildSessionEmbed(guild, session, attended);
        await msg.edit({ embeds: [embed], components: [buildAttendanceButtons(false)] });
      }
    }
  } catch (_) {}
}

module.exports = { handleButton };
