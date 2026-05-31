// commands/rank.js
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { buildRankPanel } = require('../handlers/userPanelHandler.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Bảng xếp hạng điểm danh')
    .setDefaultMemberPermissions(0n),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const panel = await buildRankPanel(interaction.guild);
    return interaction.editReply(panel);
  },
};
