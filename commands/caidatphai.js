// commands/caidatphai.js
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { laAdmin } = require('../utils/helpers.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cai_dat_phai')
    .setDescription('[Admin] Cấu hình các role phái tham gia điểm danh')
    .setDefaultMemberPermissions(0n)
    .addRoleOption(o =>
      o.setName('phai1').setDescription('Phái 1').setRequired(false)
    )
    .addRoleOption(o =>
      o.setName('phai2').setDescription('Phái 2').setRequired(false)
    )
    .addRoleOption(o =>
      o.setName('phai3').setDescription('Phái 3').setRequired(false)
    )
    .addRoleOption(o =>
      o.setName('phai4').setDescription('Phái 4').setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild, member } = interaction;

    const cfg = await db.getConfig(guild.id);
    if (!laAdmin(member, cfg)) {
      return interaction.editReply({ content: '🔒 Bạn không có quyền dùng lệnh này.' });
    }

    const roles = ['phai1','phai2','phai3','phai4']
      .map(n => interaction.options.getRole(n))
      .filter(Boolean)
      .map(r => r.id);

    if (roles.length === 0) {
      const current = cfg.phai_role_ids ?? [];
      return interaction.editReply({
        content: current.length
          ? `ℹ️ Các phái hiện tại: ${current.map(id => `<@&${id}>`).join(', ')}`
          : 'ℹ️ Chưa có phái nào được cấu hình.',
      });
    }

    await db.setConfig(guild.id, { phai_role_ids: roles });
    return interaction.editReply({
      content: `✅ Đã cập nhật ${roles.length} phái: ${roles.map(id => `<@&${id}>`).join(', ')}`,
    });
  },
};
