// commands/xem.js
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { buildSessionEmbed, buildAttendanceButtons } = require('../utils/embeds.js');

const data = new SlashCommandBuilder()
  .setName('xem_diemdanh')
  .setDescription('Xem trạng thái phiên điểm danh đang mở');

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const session = await db.getActiveSession(interaction.guild.id);

  if (!session) {
    return interaction.editReply({ content: '📭 Không có phiên điểm danh nào đang mở.' });
  }

  const attended = await db.getAttendances(session.id);
  const embed    = await buildSessionEmbed(interaction.guild, session, attended);
  await interaction.editReply({ embeds: [embed] });
}

module.exports = { data, execute };
