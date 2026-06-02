// src/commands/members/xoa.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { replyConfirm } = require('../../../utils/embeds.js');

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
    const target = interaction.options.getUser('thanh_vien');

    return interaction.editReply(
      replyConfirm(
        `Xóa <@${target.id}> khỏi danh sách thành viên?\n> Hành động này sẽ xóa luôn lịch sử điểm danh của họ.`,
        `xoa:confirm:${target.id}`,
        `xoa:cancel:${target.id}`,
      ),
    );
  }
}

module.exports = { XoaCommand };
