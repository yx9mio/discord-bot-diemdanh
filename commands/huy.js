// commands/huy.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../db.js');
const { voHieuHoaNutDiemDanh } = require('../utils/session.js');
const { xoaHenGio } = require('../utils/timers.js');
const { laAdmin } = require('../utils/helpers.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('huy_diemdanh')
    .setDescription('Hủy phiên điểm danh đang mở (không lưu kết quả)')
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

    xoaHenGio(guild.id);
    await db.cancelSession(session.id);
    await voHieuHoaNutDiemDanh(interaction.client, channel, session);

    return interaction.editReply({ content: '✅ Đã hủy phiên điểm danh.' });
  },
};
