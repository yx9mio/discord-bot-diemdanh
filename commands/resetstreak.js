// commands/resetstreak.js
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { laAdmin } = require('../utils/helpers.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset_streak')
    .setDescription('[Admin] Reset streak điểm danh của một thành viên')
    .setDefaultMemberPermissions(0n)
    .addUserOption(o =>
      o.setName('thanh_vien').setDescription('Thành viên cần reset streak').setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild, member } = interaction;

    const cfg = await db.getConfig(guild.id);
    if (!laAdmin(member, cfg)) {
      return interaction.editReply({ content: '🔒 Bạn không có quyền dùng lệnh này.' });
    }

    const target = interaction.options.getUser('thanh_vien');
    await db.resetMemberStreak(guild.id, target.id);

    return interaction.editReply({
      content: `✅ Đã reset streak của <@${target.id}> về 0.`,
    });
  },
};
