// src/commands/lichcodinh.js
'use strict';
const { Command } = require('@sapphire/framework');
const { PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../db.js');

const DAY_OPTIONS = [
  { name: 'Thứ 2', value: '1' }, { name: 'Thứ 3', value: '2' },
  { name: 'Thứ 4', value: '3' }, { name: 'Thứ 5', value: '4' },
  { name: 'Thứ 6', value: '5' }, { name: 'Thứ 7', value: '6' },
  { name: 'Chủ nhật', value: '0' },
];
const DAY_LABEL = { '0': 'CN', '1': 'T2', '2': 'T3', '3': 'T4', '4': 'T5', '5': 'T6', '6': 'T7' };

class LichcodinhCommand extends Command {
  constructor(context) {
    super(context, { name: 'lichcodinh', description: 'Cài đặt lịch điểm danh tự động', preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(builder =>
      builder
        .setName('lichcodinh')
        .setDescription('Cài đặt lịch điểm danh tự động')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(s => s.setName('xem').setDescription('Xem danh sách lịch cố định'))
        .addSubcommand(s =>
          s.setName('them').setDescription('Thêm lịch cố định mới')
            .addStringOption(o => o.setName('thu').setDescription('Thứ trong tuần').setRequired(true).addChoices(...DAY_OPTIONS))
            .addStringOption(o => o.setName('gio').setDescription('Giờ bắt đầu (HH:MM, VD: 20:00)').setRequired(true))
            .addStringOption(o => o.setName('ten').setDescription('Tên phiên mặc định').setRequired(false))
            .addIntegerOption(o => o.setName('phut').setDescription('Thời lượng phiên (phút, mặc định 60)').setRequired(false).setMinValue(5).setMaxValue(480))
            .addChannelOption(o => o.setName('kenh').setDescription('Kênh gửi thông báo').setRequired(false))
        )
        .addSubcommand(s =>
          s.setName('xoa').setDescription('Xóa lịch cố định')
            .addStringOption(o => o.setName('id').setDescription('ID lịch cần xóa').setRequired(true))
        )
        .addSubcommand(s =>
          s.setName('bat_tat').setDescription('Bật/tắt một lịch cố định')
            .addStringOption(o => o.setName('id').setDescription('ID lịch').setRequired(true))
            .addBooleanOption(o => o.setName('bat').setDescription('true = bật, false = tắt').setRequired(true))
        )
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { guild } = interaction;
    const sub = interaction.options.getSubcommand();

    if (sub === 'xem') {
      const schedules = await db.getSchedules(guild.id);
      if (!schedules.length) return interaction.editReply({ content: 'Chưa có lịch cố định nào.' });
      const lines = schedules.map(s =>
        `\`${s.id.slice(0, 8)}\` ${s.enabled ? '🟢' : '🔴'} **${DAY_LABEL[s.day_of_week]}** ${s.time} — ${s.session_name ?? 'Điểm danh'} (${s.duration_minutes ?? 60}p)${s.channel_id ? ` <#${s.channel_id}>` : ''}`
      );
      const embed = new EmbedBuilder().setColor(0x01696f).setTitle('📅 Lịch Điểm Danh Cố Định').setDescription(lines.join('\n')).setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'them') {
      const day      = interaction.options.getString('thu');
      const time     = interaction.options.getString('gio');
      const name     = interaction.options.getString('ten') ?? null;
      const duration = interaction.options.getInteger('phut') ?? 60;
      const channel  = interaction.options.getChannel('kenh') ?? null;

      if (!/^\d{1,2}:\d{2}$/.test(time)) return interaction.editReply({ content: '⚠️ Giờ không hợp lệ. Dùng định dạng HH:MM (VD: 20:00).' });

      await db.createSchedule({
        guild_id: guild.id, day_of_week: parseInt(day), time,
        session_name: name, duration_minutes: duration,
        channel_id: channel?.id ?? null, enabled: true,
      });
      return interaction.editReply({ content: `✅ Đã thêm lịch: **${DAY_LABEL[day]}** ${time} (${duration}p)` });
    }

    if (sub === 'xoa') {
      const id = interaction.options.getString('id');
      await db.deleteSchedule(id, guild.id);
      return interaction.editReply({ content: `✅ Đã xóa lịch \`${id}\`.` });
    }

    if (sub === 'bat_tat') {
      const id  = interaction.options.getString('id');
      const bat = interaction.options.getBoolean('bat');
      await db.toggleSchedule(id, guild.id, bat);
      return interaction.editReply({ content: `${bat ? '🟢 Đã bật' : '🔴 Đã tắt'} lịch \`${id}\`.` });
    }
  }
}

module.exports = { LichcodinhCommand };
