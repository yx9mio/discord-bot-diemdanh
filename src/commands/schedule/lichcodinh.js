// src/commands/schedule/lichcodinh.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../db.js');

const DAY_VI = ['CN','T2','T3','T4','T5','T6','T7'];

class LichCoDinhCommand extends Command {
  constructor(context) {
    super(context, { name: 'lichcodinh', description: 'Quản lý lịch điểm danh cố định', preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('lichcodinh')
        .setDescription('Quản lý lịch điểm danh cố định')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(s => s.setName('xem').setDescription('Xem lịch hiện tại'))
        .addSubcommand(s => s
          .setName('them')
          .setDescription('Thêm lịch cố định')
          .addIntegerOption(o => o.setName('thu').setDescription('Thứ trong tuần (0=CN, 1=T2...6=T7)').setRequired(true).setMinValue(0).setMaxValue(6))
          .addIntegerOption(o => o.setName('gio').setDescription('Giờ (0-23)').setRequired(true).setMinValue(0).setMaxValue(23))
          .addIntegerOption(o => o.setName('phut').setDescription('Phút (0-59)').setRequired(true).setMinValue(0).setMaxValue(59))
          .addStringOption(o => o.setName('ten').setDescription('Tên phiên tự động').setRequired(false))
        )
        .addSubcommand(s => s
          .setName('xoa')
          .setDescription('Xóa lịch theo index')
          .addIntegerOption(o => o.setName('index').setDescription('Số thứ tự (xem bằng /lichcodinh xem)').setRequired(true).setMinValue(1))
        )
        .addSubcommand(s => s.setName('xoa_tat_ca').setDescription('Xóa tất cả lịch cố định'))
        .addSubcommand(s => s
          .setName('bat_tat')
          .setDescription('Bật/tắt tự động tạo phiên')
          .addBooleanOption(o => o.setName('kich_hoat').setDescription('true = bật').setRequired(true))
        )
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub  = interaction.options.getSubcommand();
    const { guild } = interaction;
    const cfg  = await db.getGuildConfig(guild.id);
    const schedules = cfg.schedules ?? [];

    if (sub === 'xem') {
      const embed = new EmbedBuilder().setColor(0x01696f).setTitle('📅 Lịch điểm danh cố định');
      if (!schedules.length) {
        embed.setDescription('_Chưa có lịch nào_');
      } else {
        embed.setDescription(schedules.map((s, i) =>
          `**${i + 1}.** ${DAY_VI[s.day_of_week]} ${String(s.hour).padStart(2,'0')}:${String(s.minute).padStart(2,'0')} — ${s.session_name ?? 'Auto'}`
        ).join('\n'));
      }
      embed.addFields({ name: '🔔 Tự động', value: cfg.auto_schedule_enabled ? '✅ Đang bật' : '❌ Tắt', inline: true });
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'them') {
      const entry = {
        day_of_week:  interaction.options.getInteger('thu'),
        hour:         interaction.options.getInteger('gio'),
        minute:       interaction.options.getInteger('phut'),
        session_name: interaction.options.getString('ten') ?? null,
      };
      schedules.push(entry);
      await db.setGuildConfig(guild.id, { schedules });
      return interaction.editReply({ content: `✅ Đã thêm lịch: ${DAY_VI[entry.day_of_week]} ${String(entry.hour).padStart(2,'0')}:${String(entry.minute).padStart(2,'0')}` });
    }

    if (sub === 'xoa') {
      const idx = interaction.options.getInteger('index') - 1;
      if (idx < 0 || idx >= schedules.length) return interaction.editReply({ content: '⚠️ Index không hợp lệ.' });
      schedules.splice(idx, 1);
      await db.setGuildConfig(guild.id, { schedules });
      return interaction.editReply({ content: '✅ Đã xóa lịch.' });
    }

    if (sub === 'xoa_tat_ca') {
      await db.setGuildConfig(guild.id, { schedules: [] });
      return interaction.editReply({ content: '✅ Đã xóa tất cả lịch.' });
    }

    if (sub === 'bat_tat') {
      const enabled = interaction.options.getBoolean('kich_hoat');
      await db.setGuildConfig(guild.id, { auto_schedule_enabled: enabled });
      return interaction.editReply({ content: `✅ Tự động tạo phiên: ${enabled ? '**bật**' : '**tắt**'}.` });
    }
  }
}

module.exports = { LichCoDinhCommand };
