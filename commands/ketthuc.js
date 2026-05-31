// commands/ketthuc.js
'use strict';
const { SlashCommandBuilder } = require('discord.js');
const db  = require('../db.js');
const { buildSummaryEmbed, replyOkEdit, replyWarnEdit } = require('../utils/embeds.js');
const { requireAdmin }                                  = require('../utils/permissions.js');
const { ketThucPhien, thongBaoHuyHieu, voHieuHoaNutDiemDanh } = require('../utils/session.js');
const { xoaHenGio }                                     = require('../utils/timers.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ket_thuc')
    .setDescription('Kết thúc phiên điểm danh đang mở'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild, channel } = interaction;

    const { ok, cfg } = await requireAdmin(interaction, { context: '/ket_thuc' });
    if (!ok) return;

    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply(replyWarnEdit('📭 Không có phiên nào đang mở.'));

    const attended = await db.getAttendances(session.id);

    // 1. Cập nhật member stats + endSession + lấy statsMap cho badge check
    const statsMap = await ketThucPhien(guild, session, attended);

    // 2. Disable nút điểm danh trên message gốc
    await voHieuHoaNutDiemDanh(interaction.client, channel, session);

    // 3. Gửi embed tổng kết ra channel (public)
    const phaiRoleIds = cfg?.phai_role_ids?.length ? cfg.phai_role_ids : null;
    await channel.send({ embeds: [buildSummaryEmbed(session, attended, guild, phaiRoleIds)] });

    // 4. Thông báo huy hiệu mới đạt được
    await thongBaoHuyHieu(guild, channel, guild.id, session.id, attended, statsMap);

    // 5. Dọn timer auto-close nếu còn treo
    xoaHenGio(guild.id);

    return interaction.editReply(replyOkEdit('Đã kết thúc phiên điểm danh.'));
  },
};
