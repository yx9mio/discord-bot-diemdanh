// src/commands/member.js
'use strict';
const { Command } = require('@sapphire/framework');
const { PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../db.js');

class MemberCommand extends Command {
  constructor(context) {
    super(context, { name: 'member', description: 'Xem thông tin điểm danh của một thành viên', preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(builder =>
      builder
        .setName('member')
        .setDescription('Xem thông tin điểm danh của một thành viên')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addUserOption(o => o.setName('thanh_vien').setDescription('Thành viên cần xem').setRequired(true))
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const target = interaction.options.getUser('thanh_vien');
    const { guild } = interaction;
    const stats = await db.getUserStats(guild.id, target.id);

    const embed = new EmbedBuilder()
      .setColor(0x01696f)
      .setTitle(`👤 Thông tin: ${target.username}`)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: '✅ Tham gia',       value: `${stats.present ?? 0}`,       inline: true },
        { name: '⏰ Trễ',           value: `${stats.late ?? 0}`,          inline: true },
        { name: '❌ Vắng',          value: `${stats.absent ?? 0}`,        inline: true },
        { name: '🔥 Streak hiện tại', value: `${stats.streak ?? 0}`,      inline: true },
        { name: '🏆 Streak cao nhất', value: `${stats.best_streak ?? 0}`, inline: true },
      ).setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

module.exports = { MemberCommand };
