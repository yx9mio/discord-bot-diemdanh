// src/commands/members/xoa.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../db.js');

class XoaCommand extends Command {
  constructor(context) {
    super(context, { name: 'xoa', description: 'Xóa thành viên khỏi danh sách quản lý', preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('xoa')
        .setDescription('Xóa thành viên khỏi danh sách quản lý')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addUserOption(o => o.setName('thanh_vien').setDescription('Thành viên cần xóa').setRequired(true))
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;
    const target = interaction.options.getUser('thanh_vien');

    await db.deleteMember(guild.id, target.id);

    await interaction.editReply({ content: `✅ Đã xóa <@${target.id}> khỏi danh sách.` });
  }
}

module.exports = { XoaCommand };
