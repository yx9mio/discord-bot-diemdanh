// src/commands/schedule/nhacnho.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../../db.js');
const { FOOTER_DEFAULT } = require('../../../utils/embeds.js');

class NhacNhoCommand extends Command {
  constructor(context) {
    super(context, { name: 'nhacnho', description: 'Cài đặt nhắc nhở trước phiên', preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('nhacnho')
        .setDescription('Cài đặt nhắc nhở trước phiên')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(s => s.setName('xem').setDescription('Xem cài đặt nhắc nhở hiện tại'))
        .addSubcommand(s => s
          .setName('caidat')
          .setDescription('Cài đặt thời gian nhắc nhở')
          .addIntegerOption(o => o.setName('phut_truoc').setDescription('Nhắc trước bao nhiêu phút').setRequired(true).setMinValue(1).setMaxValue(60))
          .addChannelOption(o => o.setName('kenh').setDescription('Kênh nhắc nhở').setRequired(false))
        )
        .addSubcommand(s => s.setName('tat').setDescription('Tắt nhắc nhở'))
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub  = interaction.options.getSubcommand();
    const { guild } = interaction;
    const cfg  = await db.getGuildConfig(guild.id);

    if (sub === 'xem') {
      const embed = new EmbedBuilder().setColor(0x01696f).setTitle('🔔 Cài đặt nhắc nhở')
        .addFields(
          { name: 'Phút trước', value: cfg.reminder_minutes ? `${cfg.reminder_minutes} phút` : '_Chưa cài_', inline: true },
          { name: 'Kênh',       value: cfg.reminder_channel_id ? `<#${cfg.reminder_channel_id}>` : '_Chưa cài_', inline: true },
          { name: 'Trạng thái', value: cfg.reminder_enabled ? '✅ Bật' : '❌ Tắt', inline: true },
        )
        .setFooter({ text: FOOTER_DEFAULT });
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'caidat') {
      const minutes = interaction.options.getInteger('phut_truoc');
      const channel = interaction.options.getChannel('kenh');
      await db.setGuildConfig(guild.id, {
        reminder_minutes:    minutes,
        reminder_channel_id: channel?.id ?? cfg.reminder_channel_id ?? null,
        reminder_enabled:    true,
      });
      return interaction.editReply({ content: `✅ Nhắc nhở trước **${minutes} phút**.${channel ? ` Kênh: <#${channel.id}>` : ''}` });
    }

    if (sub === 'tat') {
      await db.setGuildConfig(guild.id, { reminder_enabled: false });
      return interaction.editReply({ content: '✅ Đã tắt nhắc nhở.' });
    }
  }
}

module.exports = { NhacNhoCommand };
