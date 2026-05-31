// handlers/buttonHandler.js
const db = require('../db.js');
const { buildSessionEmbed, buildAttendanceButtons, buildConfigEmbed } = require('../utils/embeds.js');
const { ketThucPhien, thongBaoHuyHieu, voHieuHoaNutDiemDanh } = require('../utils/session.js');
const { xoaHenGio } = require('../utils/timers.js');

const STATUS_LABEL = {
  tham_gia:       '✅ Tham Gia',
  tre:            '⏰ Đến Trễ',
  khong_tham_gia: '❌ Vắng Mặt',
};

async function handleButton(interaction) {
  const { customId, guild, member, user, channel } = interaction;

  // ── Setup shortcuts ─────────────────────────────────────────────
  if (customId === 'setup_help') {
    const { handleSelectMenu } = require('../commands/help.js');
    // Trigger /help trực tiếp bằng cách gọi execute
    const { execute } = require('../commands/help.js');
    return execute(interaction);
  }

  if (customId === 'setup_config') {
    await interaction.deferReply({ ephemeral: true });
    const cfg = await db.getConfig(guild.id);
    return interaction.editReply({ embeds: [buildConfigEmbed(cfg)] });
  }

  // ── Xem danh sách ───────────────────────────────────────────────
  if (customId === 'attend_view') {
    const session = await db.getActiveSession(guild.id);
    if (!session) {
      return interaction.reply({ content: '📭 Không có phiên điểm danh nào đang mở.', ephemeral: true });
    }
    const attended = await db.getAttendances(session.id);
    const embed    = await buildSessionEmbed(guild, session, attended);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ── Đóng phiên bằng nút (nếu có) ────────────────────────────────────
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
    xoaHenGio(session.id);
    const statsMap = await ketThucPhien(guild, session, attended);
    await voHieuHoaNutDiemDanh(interaction.client, channel, session);
    const { buildSummaryEmbed } = require('../utils/embeds.js');
    await channel.send({ embeds: [buildSummaryEmbed(session, attended)] });
    await thongBaoHuyHieu(guild, channel, guild.id, session.id, attended, statsMap);
    return interaction.editReply({ content: '✅ Đã đóng phiên.' });
  }

  // ── Nút điểm danh chính ───────────────────────────────────────────
  const validStatuses = ['tham_gia', 'tre', 'khong_tham_gia'];
  if (!validStatuses.includes(customId)) return;

  await interaction.deferReply({ ephemeral: true });
  const session = await db.getActiveSession(guild.id);
  if (!session) {
    return interaction.editReply({ content: '📭 Không có phiên điểm danh nào đang mở.' });
  }

  // Kiểm tra quyền điểm danh
  if (session.allowed_role_id) {
    const hasRole = member.roles.cache.has(session.allowed_role_id);
    if (!hasRole) {
      const roleName = guild.roles.cache.get(session.allowed_role_id)?.name ?? 'role cần thiết';
      return interaction.editReply({ content: `🔒 Bạn cần có role **${roleName}** để điểm danh.` });
    }
  }

  const displayName = member.nickname ?? user.globalName ?? user.username;
  await db.upsertAttendance(session.id, guild.id, user.id, displayName, customId);

  // Cập nhật embed chính
  try {
    const ch = guild.channels.cache.get(session.channel_id);
    if (ch && session.message_id) {
      const msg = await ch.messages.fetch(session.message_id).catch(() => null);
      if (msg) {
        const attended = await db.getAttendances(session.id);
        const embed    = await buildSessionEmbed(guild, session, attended);
        await msg.edit({ embeds: [embed] }).catch(() => null);
      }
    }
  } catch (_) { /* silent */ }

  return interaction.editReply({
    content: `${STATUS_LABEL[customId] ?? '✅'} Đã ghi nhận **${STATUS_LABEL[customId]}** cho bạn.`,
  });
}

module.exports = { handleButton };
