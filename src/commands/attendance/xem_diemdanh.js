// src/commands/attendance/xem_diemdanh.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../db.js');
const { buildSessionEmbed } = require('../../../utils/embeds.js');

class XemDiemDanhCommand extends Command {
  constructor(context) {
    super(context, { name: 'xem_diemdanh', description: 'Xem danh sách điểm danh của phiên hiện tại' });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('xem_diemdanh')
        .setDescription('Xem danh sách điểm danh của phiên hiện tại')
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply({ content: '⚠️ Không có phiên nào đang mở.' });

    const attendances = await db.getAttendances(session.id);
    const cfg         = await db.getGuildConfig(guild.id);
    const phaiRoleIds = cfg.phai_role_ids ?? [];

    const embed   = buildSessionEmbed(guild, session, attendances, phaiRoleIds, false);
    const refresh = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('attend_refresh').setLabel('🔄 Làm mới').setStyle(ButtonStyle.Secondary),
    );

    await interaction.editReply({ embeds: [embed], components: [refresh] });
  }
}

module.exports = { XemDiemDanhCommand };
