// src/commands/session/huy.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../../db.js');
const { replyConfirm, replyErr } = require('../../../utils/embeds.js');

class HuyCommand extends Command {
  constructor(context) {
    super(context, { name: 'huy', description: 'Hủy phiên điểm danh hiện tại (không lưu kết quả)', preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('huy')
        .setDescription('Hủy phiên điểm danh hiện tại (không lưu kết quả)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const session = await db.getActiveSession(interaction.guild.id);
    if (!session) return interaction.editReply(replyErr('Không có phiên nào đang mở.'));

    return interaction.editReply(
      replyConfirm(
        `Hủy phiên **"${session.session_name}"**?\n> Kết quả điểm danh của phiên này sẽ không được lưu.`,
        `huy:confirm:${session.id}`,
        `huy:cancel:${session.id}`,
      ),
    );
  }
}

module.exports = { HuyCommand };
