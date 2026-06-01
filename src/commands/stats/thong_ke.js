// src/commands/stats/thong_ke.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../db.js');

class ThongKeCommand extends Command {
  constructor(context) {
    super(context, { name: 'thong_ke', description: 'Xem thống kê điểm danh cá nhân' });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('thong_ke')
        .setDescription('Xem thống kê điểm danh cá nhân')
        .addUserOption(o => o.setName('thanh_vien').setDescription('Thành viên cần xem (mặc định: bạn)').setRequired(false))
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;
    const target = interaction.options.getUser('thanh_vien') ?? interaction.user;
    const stats  = await db.getMemberStats(guild.id, target.id);

    const total   = stats?.total_sessions ?? 0;
    const present = stats?.tham_gia ?? 0;
    const late    = stats?.tre ?? 0;
    const excused = stats?.co_phep ?? 0;
    const absent  = stats?.khong_tham_gia ?? 0;
    const streak  = stats?.streak ?? 0;
    const rate    = total > 0 ? Math.round((present + late) / total * 100) : 0;

    const embed = new EmbedBuilder()
      .setColor(0x01696f)
      .setTitle(`📊 Thống kê — ${target.displayName}`)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: '✅ Tham gia',  value: `${present}`,  inline: true },
        { name: '⏰ Trễ',       value: `${late}`,     inline: true },
        { name: '🟡 Có phép',  value: `${excused}`,  inline: true },
        { name: '❌ Vắng',      value: `${absent}`,   inline: true },
        { name: '📊 Tỉ lệ',    value: `${rate}%`,    inline: true },
        { name: '🔥 Streak',   value: `${streak}`,   inline: true },
      )
      .setFooter({ text: `Tổng ${total} phiên` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

module.exports = { ThongKeCommand };
