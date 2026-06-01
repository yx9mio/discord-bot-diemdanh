// src/commands/xoa.js
'use strict';
const { Command } = require('@sapphire/framework');
const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../db.js');

class XoaCommand extends Command {
  constructor(context) {
    super(context, { name: 'xoa', description: 'Xóa điểm danh của một thành viên khỏi phiên hiện tại', preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(builder =>
      builder
        .setName('xoa')
        .setDescription('Xóa điểm danh của một thành viên khỏi phiên hiện tại')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addUserOption(o => o.setName('thanh_vien').setDescription('Thành viên cần xóa').setRequired(true))
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { guild } = interaction;
    const target  = interaction.options.getUser('thanh_vien');
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply({ content: '⚠️ Không có phiên nào đang mở.' });

    await db.removeAttendance(session.id, target.id);
    await interaction.editReply({ content: `✅ Đã xóa điểm danh của <@${target.id}> khỏi phiên.` });
  }
}

module.exports = { XoaCommand };
