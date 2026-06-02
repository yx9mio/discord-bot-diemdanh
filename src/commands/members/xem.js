// src/commands/members/xem.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../../db.js');
const { FOOTER_DEFAULT } = require('../../../utils/embeds.js');

class XemCommand extends Command {
  constructor(context) {
    super(context, { name: 'xem', description: 'Xem danh sách thành viên được quản lý', preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('xem')
        .setDescription('Xem danh sách thành viên được quản lý')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;
    const members = await db.getMembers(guild.id);

    if (!members.length) return interaction.editReply({ content: '📭 Chưa có thành viên nào trong danh sách.' });

    const lines = members.map((m, i) => `**${i + 1}.** <@${m.user_id}>${m.phong_ban ? ` — ${m.phong_ban}` : ''}`);
    const embed = new EmbedBuilder()
      .setColor(0x01696f)
      .setTitle(`👥 Danh sách thành viên (${members.length})`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: FOOTER_DEFAULT })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

module.exports = { XemCommand };
