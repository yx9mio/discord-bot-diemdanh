// src/commands/members/them.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../db.js');

class ThemCommand extends Command {
  constructor(context) {
    super(context, { name: 'them', description: 'Thêm thành viên vào danh sách quản lý', preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('them')
        .setDescription('Thêm thành viên vào danh sách quản lý')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addUserOption(o => o.setName('thanh_vien').setDescription('Thành viên cần thêm').setRequired(true))
        .addStringOption(o => o.setName('phong_ban').setDescription('Phòng ban / vai trò').setRequired(false))
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;
    const target   = interaction.options.getUser('thanh_vien');
    const phongBan = interaction.options.getString('phong_ban') ?? null;

    await db.upsertMember({ guildId: guild.id, userId: target.id, phongBan });

    const embed = new EmbedBuilder()
      .setColor(0x437a22)
      .setTitle('✅ Đã thêm thành viên')
      .setDescription(`<@${target.id}>${phongBan ? ` — ${phongBan}` : ''}`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

module.exports = { ThemCommand };
