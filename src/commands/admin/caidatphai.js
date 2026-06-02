// src/commands/admin/caidatphai.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../../db.js');
const { FOOTER_DEFAULT } = require('../../../utils/embeds.js');

class CaiDatPhaiCommand extends Command {
  constructor(context) {
    super(context, { name: 'caidatphai', description: 'Cài đặt danh sách phái được điểm danh', preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('caidatphai')
        .setDescription('Cài đặt danh sách phái được điểm danh')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(s => s.setName('xem').setDescription('Xem danh sách phái hiện tại'))
        .addSubcommand(s => s.setName('them').setDescription('Thêm role phái')
          .addRoleOption(o => o.setName('role').setDescription('Role phái').setRequired(true)))
        .addSubcommand(s => s.setName('xoa').setDescription('Xóa role phái')
          .addRoleOption(o => o.setName('role').setDescription('Role cần xóa').setRequired(true)))
        .addSubcommand(s => s.setName('xoa_tat_ca').setDescription('Xóa tất cả phái'))
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub  = interaction.options.getSubcommand();
    const { guild } = interaction;
    const cfg  = await db.getGuildConfig(guild.id);
    let roleIds = cfg.phai_role_ids ?? [];

    if (sub === 'xem') {
      const embed = new EmbedBuilder().setColor(0x01696f).setTitle('🎭 Danh sách Phái')
        .setDescription(roleIds.length ? roleIds.map(r => `<@&${r}>`).join('\n') : '_Tất cả thành viên_')
        .setFooter({ text: FOOTER_DEFAULT });
      return interaction.editReply({ embeds: [embed] });
    }
    if (sub === 'them') {
      const role = interaction.options.getRole('role');
      if (!roleIds.includes(role.id)) roleIds.push(role.id);
      await db.setGuildConfig(guild.id, { phai_role_ids: roleIds });
      return interaction.editReply({ content: `✅ Đã thêm phái: <@&${role.id}>` });
    }
    if (sub === 'xoa') {
      const role = interaction.options.getRole('role');
      roleIds = roleIds.filter(r => r !== role.id);
      await db.setGuildConfig(guild.id, { phai_role_ids: roleIds });
      return interaction.editReply({ content: `✅ Đã xóa phái: <@&${role.id}>` });
    }
    if (sub === 'xoa_tat_ca') {
      await db.setGuildConfig(guild.id, { phai_role_ids: [] });
      return interaction.editReply({ content: '✅ Đã xóa tất cả phái.' });
    }
  }
}

module.exports = { CaiDatPhaiCommand };
