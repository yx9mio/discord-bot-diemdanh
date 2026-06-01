// src/commands/status.js
'use strict';
const { Command } = require('@sapphire/framework');
const { EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../db.js');

class StatusCommand extends Command {
  constructor(context) {
    super(context, { name: 'status', description: 'Xem trạng thái bot, DB và phiên điểm danh hiện tại' });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(builder =>
      builder.setName('status').setDescription('Xem trạng thái bot, DB và phiên điểm danh hiện tại')
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { guild, client } = interaction;
    const session = await db.getActiveSession(guild.id);
    const uptime  = process.uptime();
    const h = Math.floor(uptime / 3600), m = Math.floor((uptime % 3600) / 60);

    const embed = new EmbedBuilder()
      .setColor(session ? 0x01696f : 0x7a7974)
      .setTitle('🤖 Trạng thái Bot')
      .addFields(
        { name: '🏓 Ping',    value: `${client.ws.ping}ms`, inline: true },
        { name: '⏱️ Uptime', value: `${h}h ${m}m`,         inline: true },
        { name: '🟢 Phiên',  value: session ? `**${session.session_name}** đang mở` : '_Không có phiên_', inline: false },
      ).setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

module.exports = { StatusCommand };
