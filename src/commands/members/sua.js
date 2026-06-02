// src/commands/members/sua.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../../db.js');
const { FOOTER_DEFAULT } = require('../../../utils/embeds.js');

class SuaCommand extends Command {
  constructor(context) {
    super(context, { name: 'sua', description: 'Cập nhật thông tin thành viên', preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('sua')
        .setDescription('Cập nhật thông tin thành viên')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addUserOption(o => o.setName('thanh_vien').setDescription('Thành viên cần sửa').setRequired(true))
        .addStringOption(o => o.setName('phong_ban').setDescription('Phòng ban / vai trò mới').setRequired(false))
        .addStringOption(o => o.setName('ghi_chu').setDescription('Ghi chú').setRequired(false))
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;
    const target   = interaction.options.getUser('thanh_vien');
    const phongBan = interaction.options.getString('phong_ban');
    const ghiChu   = interaction.options.getString('ghi_chu');

    const updates = {};
    if (phongBan !== null) updates.phongBan = phongBan;
    if (ghiChu   !== null) updates.ghiChu   = ghiChu;

    await db.upsertMember({ guildId: guild.id, userId: target.id, ...updates });

    const embed = new EmbedBuilder()
      .setColor(0x01696f)
      .setTitle('✏️ Đã cập nhật thành viên')
      .setDescription(`<@${target.id}>`)
      .addFields(
        ...(phongBan ? [{ name: 'Phòng ban', value: phongBan, inline: true }] : []),
        ...(ghiChu   ? [{ name: 'Ghi chú',   value: ghiChu,   inline: true }] : []),
      )
      .setFooter({ text: FOOTER_DEFAULT })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

module.exports = { SuaCommand };
