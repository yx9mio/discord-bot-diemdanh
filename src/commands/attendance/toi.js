// src/commands/attendance/toi.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../db.js');

class ToiCommand extends Command {
  constructor(context) {
    super(context, { name: 'toi', description: 'Xem thông tin điểm danh cá nhân' });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder().setName('toi').setDescription('Xem thông tin điểm danh cá nhân của bạn')
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild, user } = interaction;
    const stats = await db.getMemberStats(guild.id, user.id);

    const total       = stats?.total_sessions ?? 0;
    const present     = stats?.tham_gia ?? 0;
    const late        = stats?.tre ?? 0;
    const excused     = stats?.co_phep ?? 0;
    const absent      = stats?.khong_tham_gia ?? 0;
    const streak      = stats?.streak ?? 0;
    const rate        = total > 0 ? Math.round((present + late) / total * 100) : 0;

    const embed = new EmbedBuilder()
      .setColor(0x01696f)
      .setTitle(`👤 Thông tin của bạn`)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: '✅ Tham gia',   value: `${present}`,  inline: true },
        { name: '⏰ Trễ',        value: `${late}`,     inline: true },
        { name: '🟡 Có phép',   value: `${excused}`,  inline: true },
        { name: '❌ Vắng',       value: `${absent}`,   inline: true },
        { name: '📊 Tỉ lệ',     value: `${rate}%`,    inline: true },
        { name: '🔥 Streak',    value: `${streak}`,   inline: true },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

module.exports = { ToiCommand };
