// src/commands/stats/thongke_server.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../../db.js');
const { FOOTER_DEFAULT } = require('../../../utils/embeds.js');

class ThongKeServerCommand extends Command {
  constructor(context) {
    super(context, { name: 'thongke_server', description: 'Xem thống kê điểm danh toàn server', preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('thongke_server')
        .setDescription('Xem thống kê điểm danh toàn server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;
    const stats = await db.getServerStats(guild.id);

    const embed = new EmbedBuilder()
      .setColor(0x01696f)
      .setTitle(`📊 Thống kê server — ${guild.name}`)
      .addFields(
        { name: '📅 Tổng phiên',    value: `${stats?.total_sessions ?? 0}`,    inline: true },
        { name: '✅ Lượt tham gia', value: `${stats?.total_present ?? 0}`,     inline: true },
        { name: '❌ Lượt vắng',     value: `${stats?.total_absent ?? 0}`,      inline: true },
        { name: '👥 Thành viên',    value: `${stats?.total_members ?? 0}`,     inline: true },
        { name: '📊 Tỉ lệ TB',      value: stats?.avg_rate ? `${Math.round(stats.avg_rate)}%` : '—', inline: true },
      )
      .setFooter({ text: FOOTER_DEFAULT })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

module.exports = { ThongKeServerCommand };
