// handlers/buttonHandler.js
'use strict';
const db = require('../db.js');
const { buildSessionEmbed, buildAttendanceButtons, buildConfigEmbed,
        buildSummaryEmbed, replyOkEdit, replyErrEdit } = require('../utils/embeds.js');
const { ketThucPhien, thongBaoHuyHieu, voHieuHoaNutDiemDanh } = require('../utils/session.js');
const { xoaHenGio } = require('../utils/timers.js');
const { handleSetupUi } = require('./setupUiHandler.js');
const { requireAdmin } = require('../utils/permissions.js');

const BUTTON_TO_STATUS = {
  attend_yes:  'tham_gia',
  attend_late: 'tre',
  attend_no:   'khong_tham_gia',
};

const STATUS_LABEL = {
  tham_gia:       '✅ Tham Gia',
  tre:            '⏰ Đến Trễ',
  khong_tham_gia: '❌ Vắng Mặt',
};

// ── In-memory lock để tránh double-submit (B-5 / H-5) ────────────────────────
const _pendingLock = new Set(); // key = `${sessionId}:${userId}`

async function handleButton(interaction) {
  const { customId, guild, member, user, channel } = interaction;

  // ── Setup UI Wizard (prefix 'setup:') ──────────────────────────────────────
  if (customId?.startsWith('setup:')) {
    return handleSetupUi(interaction);
  }

  // ── Phân trang /lich_su ────────────────────────────────────────────────────
  if (customId?.startsWith('lichsu:')) {
    const parts = customId.split(':');  // ['lichsu', 'prev'|'next', currentPage]
    const action  = parts[1];
    const curPage = parseInt(parts[2], 10);
    const newPage = action === 'next' ? curPage + 1 : curPage - 1;

    await interaction.deferUpdate();
    const { buildHistoryPageEmbed, buildNavRow, PAGE_SIZE } = require('../commands/lichsu.js');
    const history    = await db.getSessionHistory(guild.id, 50);
    const totalPages = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
    const clampedPage = Math.max(0, Math.min(newPage, totalPages - 1));

    const embed = buildHistoryPageEmbed(history, clampedPage, totalPages);
    const row   = buildNavRow(clampedPage, totalPages);
    return interaction.editReply({ embeds: [embed], components: totalPages > 1 ? [row] : [] });
  }

  // ── Setup shortcuts cũ (giữ backward compat) ───────────────────────────────
  if (customId === 'setup_help') {
    const { execute } = require('../commands/help.js');
    return execute(interaction);
  }

  if (customId === 'setup_config') {
    await interaction.deferReply({ ephemeral: true });
    const cfg = await db.getConfig(guild.id);
    return interaction.editReply({ embeds: [buildConfigEmbed(cfg)] });
  }

  // ── Xem danh sách ───────────────────────────────────────────────────────────
  if (customId === 'attend_view') {
    const session = await db.getActiveSession(guild.id);
    if (!session) {
      return interaction.reply({ content: '📭 Không có phiên điểm danh nào đang mở.', ephemeral: true });
    }
    const attended = await db.getAttendances(session.id);
    const embed    = await buildSessionEmbed(guild, session, attended);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ── Đóng phiên bằng nút ────────────────────────────────────────────────────
  if (customId === 'attend_close') {
    await interaction.deferReply({ ephemeral: true });

    const { ok, cfg } = await requireAdmin(interaction, { context: 'đóng phiên' });
    if (!ok) return;

    const session = await db.getActiveSession(guild.id);
    if (!session) {
      return interaction.editReply(replyErrEdit('📭 Không có phiên nào đang mở.'));
    }

    const attended = await db.getAttendances(session.id);
    xoaHenGio(guild.id);
    const statsMap = await ketThucPhien(guild, session, attended);
    await voHieuHoaNutDiemDanh(interaction.client, channel, session);

    await channel.send({ embeds: [buildSummaryEmbed(session, attended, guild)] });
    await thongBaoHuyHieu(guild, channel, guild.id, session.id, attended, statsMap);

    return interaction.editReply(replyOkEdit('Phiên điểm danh đã được đóng thành công.'));
  }

  // ── Nút điểm danh chính ────────────────────────────────────────────────────
  const status = BUTTON_TO_STATUS[customId];
  if (!status) return;

  await interaction.deferReply({ ephemeral: true });
  const session = await db.getActiveSession(guild.id);
  if (!session) {
    return interaction.editReply({ content: '📭 Không có phiên điểm danh nào đang mở.' });
  }

  if (session.eligible_member_ids && !session.eligible_member_ids.includes(user.id)) {
    return interaction.editReply({ content: '⚠️ Bạn không nằm trong danh sách điểm danh của phiên này.' });
  }

  if (session.allowed_role_id) {
    const hasRole = member.roles.cache.has(session.allowed_role_id);
    if (!hasRole) {
      const roleName = guild.roles.cache.get(session.allowed_role_id)?.name ?? 'role cần thiết';
      return interaction.editReply({ content: `🔒 Bạn cần có role **${roleName}** để điểm danh.` });
    }
  }

  // ── Rate-limit lock (H-5): ngăn double-submit trong 3s ───────────────────
  const lockKey = `${session.id}:${user.id}`;
  if (_pendingLock.has(lockKey)) {
    return interaction.editReply({ content: '⏳ Đang xử lý, vui lòng chờ...' });
  }
  _pendingLock.add(lockKey);
  setTimeout(() => _pendingLock.delete(lockKey), 3_000);

  // FIX B-1: đổi db.upsertAttendance → db.markAttendance (đúng tên + signature)
  await db.markAttendance(session.id, user.id, status, user.id);

  // Cập nhật embed session message
  try {
    const ch = guild.channels.cache.get(session.channel_id);
    if (ch && session.message_id) {
      const msg = await ch.messages.fetch(session.message_id).catch(() => null);
      if (msg) {
        const attended = await db.getAttendances(session.id);
        const embed    = await buildSessionEmbed(guild, session, attended);
        const buttons  = buildAttendanceButtons(false);
        await msg.edit({ embeds: [embed], components: [buttons] }).catch(() => null);
      }
    }
  } catch (_) { /* silent — không làm crash flow chính */ }

  return interaction.editReply({
    content: `${STATUS_LABEL[status] ?? '✅'} Đã ghi nhận **${STATUS_LABEL[status]}** cho bạn.`,
  });
}

module.exports = { handleButton };
