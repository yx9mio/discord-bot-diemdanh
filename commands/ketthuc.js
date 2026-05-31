// commands/ketthuc.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../db.js');
const { ketThucPhien, thongBaoHuyHieu, voHieuHoaNutDiemDanh } = require('../utils/session.js');
const { xoaHenGio } = require('../utils/timers.js');
const { buildSummaryEmbed } = require('../utils/embeds.js');
const { laAdmin } = require('../utils/helpers.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ket_thuc')
    .setDescription('Kết thúc phiên điểm danh hiện tại')
    .setDefaultMemberPermissions(0n),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild, member, channel } = interaction;

    const cfg = await db.getConfig(guild.id);
    if (!laAdmin(member, cfg)) {
      return interaction.editReply({ content: '🔒 Bạn không có quyền dùng lệnh này.' });
    }

    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply({ content: '📭 Không có phiên nào đang mở.' });

    const attended = await db.getAttendances(session.id);
    xoaHenGio(guild.id);
    const statsMap = await ketThucPhien(guild, session, attended);
    await voHieuHoaNutDiemDanh(interaction.client, channel, session);

    await channel.send({ embeds: [buildSummaryEmbed(session, attended)] });
    await thongBaoHuyHieu(guild, channel, guild.id, session.id, attended, statsMap);

    return interaction.editReply({ content: '✅ Đã kết thúc phiên điểm danh.' });
  },
};
