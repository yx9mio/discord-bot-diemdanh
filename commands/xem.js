// commands/xem.js
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { buildSessionEmbed } = require('../utils/embeds.js');
const { laAdmin } = require('../utils/helpers.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xem')
    .setDescription('[Admin] Xem danh sách điểm danh phiên hiện tại')
    .setDefaultMemberPermissions(0n),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild, member } = interaction;
    const cfg = await db.getConfig(guild.id);
    if (!laAdmin(member, cfg)) {
      return interaction.editReply({ content: '🔒 Bạn không có quyền dùng lệnh này.' });
    }

    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply({ content: '📭 Không có phiên nào đang mở.' });

    const attended = await db.getAttendances(session.id);
    const embed    = await buildSessionEmbed(guild, session, attended);
    return interaction.editReply({ embeds: [embed] });
  },
};
