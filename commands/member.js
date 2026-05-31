// commands/member.js
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { laAdmin } = require('../utils/helpers.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('member')
    .setDescription('[Admin] Xem thông tin điểm danh của một thành viên')
    .setDefaultMemberPermissions(0n)
    .addUserOption(o =>
      o.setName('thanh_vien').setDescription('Thành viên cần xem').setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild, member } = interaction;
    const cfg = await db.getConfig(guild.id);
    if (!laAdmin(member, cfg)) {
      return interaction.editReply({ content: '🔒 Bạn không có quyền dùng lệnh này.' });
    }

    const target = interaction.options.getUser('thanh_vien');
    const stats  = await db.getMemberStats(guild.id, target.id);
    const pct    = stats.total_sessions > 0
      ? Math.round((stats.total_joined / stats.total_sessions) * 100) : 0;

    return interaction.editReply({
      content: [
        `📊 **Thống kê của <@${target.id}>**`,
        `> Tham gia: **${stats.total_joined}** / **${stats.total_sessions}** phiên (${pct}%)`,
        `> Streak hiện tại: **${stats.current_streak}**  |  Best: **${stats.best_streak}**`,
      ].join('\n'),
    });
  },
};
