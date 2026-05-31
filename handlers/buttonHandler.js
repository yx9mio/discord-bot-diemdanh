// handlers/buttonHandler.js
const db = require('../db.js');
const { buildSessionEmbed, buildAttendanceButtons } = require('../utils/embeds.js');
const { ketThucPhien, thongBaoHuyHieu, voHieuHoaNutDiemDanh } = require('../utils/session.js');
const { xoaHenGio } = require('../utils/timers.js');

const STATUS_LABEL = {
  tham_gia:       '✅ Tham Gia',
  tre:            '⏰ Đến Trễ',
  khong_tham_gia: '❌ Vắng Mặt',
};

async function handleButton(interaction) {
  const { customId, guild, member, user, channel } = interaction;

  // ── Xem danh sách ──────────────────────────────────────────
  if (customId === 'attend_view') {
    const session = await db.getActiveSession(guild.id);
    if (!session) {
      return interaction.reply({ content: '📭 Không có phiên điểm danh nào đang mở.', ephemeral: true });
    }
    const attended = await db.getAttendances(session.id);
    const embed    = await buildSessionEmbed(guild, session, attended);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ── Đóng phiên bằng nút (nếu có) ───────────────────────────
  if (customId === 'attend_close') {
    await interaction.deferReply({ ephemeral: true });
    const cfg = await db.getConfig(guild.id);
    const { laAdmin } = require('../utils/helpers.js');
    if (!laAdmin(member, cfg)) {
      return interaction.editReply({ content: '🔒 Bạn không có quyền đóng phiên.' });
    }
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply({ content: '📭 Không có phiên nào đang mở.' });
    const attended = await db.getAttendances(session.id);
    const statsMap = await ketThucPhien(guild, session, attended);
    xoaHenGio(guild.id);
    const sessionChannel = session.channel_id
      ? await guild.channels.fetch(session.channel_id).catch(() => channel)
      : channel;
    await voHieuHoaNutDiemDanh(interaction.client, sessionChannel, session);
    await thongBaoHuyHieu(guild, channel, guild.id, session.id, attended, statsMap);
    return interaction.editReply({ content: '🔒 Phiên đã được đóng.' });
  }

  // ── Điểm danh (yes / late / no) ────────────────────────────
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

  if (!session.eligible_member_ids.includes(user.id)) {
    return interaction.editReply({ content: '🔒 Bạn không nằm trong danh sách điểm danh của phiên này.' });
  }
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
    if (!session.message_id) return;
    const targetChannel = session.channel_id
      ? await guild.channels.fetch(session.channel_id).catch(() => channel)
      : channel;
    const msg = await targetChannel.messages.fetch(session.message_id).catch(() => null);
    if (!msg) return;
    const attended = await db.getAttendances(session.id);
    const embed    = await buildSessionEmbed(guild, session, attended);
    await msg.edit({ embeds: [embed], components: [buildAttendanceButtons(false)] });
  } catch (_) {}
}

module.exports = { handleButton };
