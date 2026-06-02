// src/commands/session/status.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder } = require('discord.js');
const db = require('../../../db.js');
const { buildSessionEmbed, buildSessionActionRow } = require('../../../utils/embeds.js');

class StatusCommand extends Command {
  constructor(context) {
    super(context, { name: 'status', description: 'Xem trạng thái phiên đang chạy' });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder().setName('status').setDescription('Xem trạng thái phiên điểm danh hiện tại')
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply({ content: '📭 Không có phiên nào đang mở.' });

    const attendances = await db.getAttendances(session.id);
    const cfg         = await db.getGuildConfig(guild.id);
    const phaiRoleIds = cfg.phai_role_ids ?? [];

    const embed   = buildSessionEmbed(guild, session, attendances, phaiRoleIds, false);
    const actions = buildSessionActionRow(false);

    await interaction.editReply({ embeds: [embed], components: actions });
  }
}

module.exports = { StatusCommand };
