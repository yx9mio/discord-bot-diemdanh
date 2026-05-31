// commands/toi.js — /toi: Xem thống kê điểm danh cá nhân
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { buildUserPanel } = require('../handlers/userPanelHandler.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('toi')
    .setDescription('Xem thống kê điểm danh cá nhân của bạn'),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const panel = await buildUserPanel(
      interaction.guild,
      interaction.member,
      interaction.user.id
    );
    return interaction.editReply(panel);
  },
};
