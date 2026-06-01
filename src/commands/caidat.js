// src/commands/caidat.js
'use strict';
const { Command } = require('@sapphire/framework');
const { PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../db.js');

class CaidatCommand extends Command {
  constructor(context) {
    super(context, { name: 'caidat', description: 'Xem hoặc thay đổi cài đặt bot cho server', preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(builder =>
      builder
        .setName('caidat')
        .setDescription('Xem hoặc thay đổi cài đặt bot cho server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(s => s.setName('xem').setDescription('Xem cài đặt hiện tại'))
        .addSubcommand(s =>
          s.setName('log_channel').setDescription('Đặt kênh ghi log')
            .addChannelOption(o => o.setName('kenh').setDescription('Kênh log').setRequired(true))
        )
        .addSubcommand(s => s.setName('xoa_log').setDescription('Xóa kênh log'))
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { guild } = interaction;
    const sub = interaction.options.getSubcommand();

    if (sub === 'xem') {
      const cfg = await db.getGuildConfig(guild.id);
      const embed = new EmbedBuilder()
        .setColor(0x01696f)
        .setTitle('⚙️ Cài đặt Bot')
        .addFields(
          { name: '📢 Log Channel', value: cfg.log_channel_id ? `<#${cfg.log_channel_id}>` : '_Chưa đặt_', inline: true },
          { name: '🎭 Phai Roles',  value: cfg.phai_role_ids?.length ? cfg.phai_role_ids.map(r => `<@&${r}>`).join(', ') : '_Tất cả_', inline: true },
        ).setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'log_channel') {
      const ch = interaction.options.getChannel('kenh');
      await db.setGuildConfig(guild.id, { log_channel_id: ch.id });
      return interaction.editReply({ content: `✅ Đã đặt log channel: <#${ch.id}>` });
    }

    if (sub === 'xoa_log') {
      await db.setGuildConfig(guild.id, { log_channel_id: null });
      return interaction.editReply({ content: '✅ Đã xóa log channel.' });
    }
  }
}

module.exports = { CaidatCommand };
