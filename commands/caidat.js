// commands/caidat.js
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { buildConfigEmbed } = require('../utils/embeds.js');
const { laAdmin } = require('../utils/helpers.js');

const data = new SlashCommandBuilder()
  .setName('cai_dat')
  .setDescription('Cài đặt bot điểm danh')
  .addSubcommand(s =>
    s.setName('role')
      .setDescription('Thiết lập role được điểm danh')
      .addRoleOption(o => o.setName('role').setDescription('Role hợp lệ (bỏ trống = tất cả)')))
  .addSubcommand(s =>
    s.setName('admin_role')
      .setDescription('Thiết lập role quản lý bot')
      .addRoleOption(o => o.setName('role').setDescription('Role quản lý (bỏ trống = chỉ admin server)')))
  .addSubcommand(s => s.setName('xem').setDescription('Xem cấu hình hiện tại'));

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const guild = interaction.guild;

  // 'xem' ai cũng xem được (ephemeral)
  if (sub === 'xem') {
    await interaction.deferReply({ ephemeral: true });
    const cfg = await db.getConfig(guild.id);
    return interaction.editReply({ embeds: [buildConfigEmbed(cfg)] });
  }

  await interaction.deferReply({ ephemeral: true });
  const cfg = await db.getConfig(guild.id);

  if (!laAdmin(interaction.member, cfg)) {
    return interaction.editReply({ content: '🔒 Bạn không có quyền thực hiện lệnh này.' });
  }

  const role = interaction.options.getRole('role');

  if (sub === 'role') {
    await db.setConfig(guild.id, { allowed_role_id: role?.id ?? null });
    const msg = role ? `✅ Đã thiết lập role điểm danh: **${role.name}**.` : '✅ Đã đặt về tất cả thành viên.';
    await interaction.editReply({ content: msg });
  } else if (sub === 'admin_role') {
    await db.setConfig(guild.id, { admin_role_id: role?.id ?? null });
    const msg = role ? `✅ Đã thiết lập role quản lý: **${role.name}**.` : '✅ Chỉ quản trị viên mới có quyền quản lý bot.';
    await interaction.editReply({ content: msg });
  }
}

module.exports = { data, execute };
