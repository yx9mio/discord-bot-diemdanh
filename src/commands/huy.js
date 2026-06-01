// src/commands/huy.js
'use strict';
const { Command } = require('@sapphire/framework');
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../db.js');

class HuyCommand extends Command {
  constructor(context) {
    super(context, { name: 'huy', description: 'Hủy phiên điểm danh hiện tại (không lưu kết quả)', preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(builder =>
      builder
        .setName('huy')
        .setDescription('Hủy phiên điểm danh hiện tại (không lưu kết quả)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply({ content: '⚠️ Không có phiên nào đang mở.' });

    await db.cancelSession(session.id);
    const embed = new EmbedBuilder()
      .setColor(0xa12c7b)
      .setTitle('🚫 Phiên đã bị hủy')
      .setDescription(`Phiên **${session.session_name}** đã bị hủy bởi <@${interaction.user.id}>.`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    if (session.message_id && session.channel_id) {
      const ch = guild.channels.cache.get(session.channel_id);
      if (ch) {
        const msg = await ch.messages.fetch(session.message_id).catch(() => null);
        if (msg) await msg.edit({ embeds: [embed], components: [] }).catch(() => null);
      }
    }
  }
}

module.exports = { HuyCommand };
