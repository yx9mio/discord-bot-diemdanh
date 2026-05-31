// commands/caidat.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../db.js');
const { laAdmin } = require('../utils/helpers.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cai_dat')
    .setDescription('[Admin] Thiết lập role điểm danh và role Admin bot')
    .setDefaultMemberPermissions(0n)
    .addRoleOption(o =>
      o.setName('role_diemdanh').setDescription('Role cần có để điểm danh').setRequired(false)
    )
    .addRoleOption(o =>
      o.setName('role_admin').setDescription('Role Admin của bot (có thể dùng lệnh quản lý)').setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild, member } = interaction;

    const cfg = await db.getConfig(guild.id);
    if (!laAdmin(member, cfg)) {
      return interaction.editReply({ content: '🔒 Bạn không có quyền dùng lệnh này.' });
    }

    const roleDD    = interaction.options.getRole('role_diemdanh');
    const roleAdmin = interaction.options.getRole('role_admin');

    if (!roleDD && !roleAdmin) {
      const current = await db.getConfig(guild.id);
      return interaction.editReply({
        content: [
          `ℹ️ Cấu hình hiện tại:`,
          `▸ Role điểm danh: ${current.allowed_role_id ? `<@&${current.allowed_role_id}>` : 'Chưa đặt'}`,
          `▸ Role Admin bot: ${current.admin_role_id ? `<@&${current.admin_role_id}>` : 'Chưa đặt'}`,
        ].join('\n'),
      });
    }

    const updates = {};
    if (roleDD)    updates.allowed_role_id = roleDD.id;
    if (roleAdmin) updates.admin_role_id   = roleAdmin.id;

    await db.setConfig(guild.id, updates);
    return interaction.editReply({ content: '✅ Đã cập nhật cấu hình.' });
  },
};
