// commands/lichsu.js
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { buildHistoryEmbed } = require('../utils/embeds.js');

const data = new SlashCommandBuilder()
  .setName('lich_su')
  .setDescription('Xem lịch sử các phiên điểm danh gần nhất')
  .addIntegerOption(o => o.setName('so_luong').setDescription('Số phiên cần xem (mặc định 10)').setMinValue(1).setMaxValue(25));

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const limit   = interaction.options.getInteger('so_luong') ?? 10;
  const history = await db.getSessionHistory(interaction.guild.id, limit);
  await interaction.editReply({ embeds: [buildHistoryEmbed(history)] });
}

module.exports = { data, execute };
