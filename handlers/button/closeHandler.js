// handlers/button/closeHandler.js — nút đóng phiên + nút xem danh sách
'use strict';
const db = require('../../db.js');
const { buildSessionEmbed, buildSummaryEmbed, replyErrEdit, replyOkEdit } = require('../../utils/embeds.js');
const { ketThucPhien, thongBaoHuyHieu, voHieuHoaNutDiemDanh } = require('../../utils/session.js');
const { xoaHenGio } = require('../../utils/timers.js');
const { requireAdmin } = require('../../utils/permissions.js');

async function handleView(interaction) {
  const { guild } = interaction;
  const session = await db.getActiveSession(guild.id);
  if (!session) {
    await interaction.reply({ content: '📭 Không có phiên điểm danh nào đang mở.', ephemeral: true });
    return true;
  }
  const attended = await db.getAttendances(session.id);
  const embed    = await buildSessionEmbed(guild, session, attended);
  await interaction.reply({ embeds: [embed], ephemeral: true });
  return true;
}

async function handleClose(interaction) {
  const { guild, channel } = interaction;
  await interaction.deferReply({ ephemeral: true });
  const { ok } = await requireAdmin(interaction, { context: 'đóng phiên' });
  if (!ok) return true;

  const session = await db.getActiveSession(guild.id);
  if (!session) {
    await interaction.editReply(replyErrEdit('📭 Không có phiên nào đang mở.'));
    return true;
  }

  const attended = await db.getAttendances(session.id);
  xoaHenGio(guild.id);
  const statsMap = await ketThucPhien(guild, session, attended);
  await voHieuHoaNutDiemDanh(interaction.client, channel, session);
  await channel.send({ embeds: [buildSummaryEmbed(session, attended, guild)] });
  await thongBaoHuyHieu(guild, channel, guild.id, session.id, attended, statsMap);
  await interaction.editReply(replyOkEdit('Phiên điểm danh đã được đóng thành công.'));
  return true;
}

module.exports = { handleView, handleClose };
