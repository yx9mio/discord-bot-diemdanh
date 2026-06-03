// src/commands/session/status.js
'use strict';
const { Command } = require('@sapphire/framework');
const { MessageFlags, SlashCommandBuilder } = require('discord.js');
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
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { guild } = interaction;
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply({ content: '📭 Không có phiên nào đang mở.' });

    // Parallel execution: getAttendances và getGuildConfig độc lập với nhau
    const [attendances, cfg] = await Promise.all([
      db.getAttendances(session.id),
      db.getGuildConfig(guild.id),
    ]);
    const phaiRoleIds = cfg.phai_role_ids ?? [];

    const { embed, components: paginationComponents } = buildSessionEmbed(guild, session, attendances, phaiRoleIds, false);
    const actions = buildSessionActionRow(false);

    await interaction.editReply({ embeds: [embed], components: [...actions, ...paginationComponents] });
  }
}

module.exports = { StatusCommand };
