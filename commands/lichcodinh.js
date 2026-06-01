'use strict';
const { Command } = require('@sapphire/framework');

// ── Logic gốc ──────────────────────────────────────────────────────────────
// commands/lichcodinh.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../db.js');

const DAY_OPTIONS = [
  { name: 'Thứ 2', value: '1' }, { name: 'Thứ 3', value: '2' },
  { name: 'Thứ 4', value: '3' }, { name: 'Thứ 5', value: '4' },
  { name: 'Thứ 6', value: '5' }, { name: 'Thứ 7', value: '6' },
  { name: 'Chủ nhật', value: '0' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lichcodinh')
    .setDescription('Cài đặt lịch điểm danh cố định tự động')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('xem').setDescription('Xem lịch hiện tại'))
    .addSubcommand(s => s
      .setName('them')
      .setDescription('Thêm lịch cố định mới')
      .addStringOption(o => o.setName('thu').setDescription('Thứ trong tuần').setRequired(true).addChoices(...DAY_OPTIONS))
      .addIntegerOption(o => o.setName('gio').setDescription('Giờ (0-23)').setRequired(true).setMinValue(0).setMaxValue(23))
      .addIntegerOption(o => o.setName('phut').setDescription('Phút (0-59)').setRequired(true).setMinValue(0).setMaxValue(59))
      .addStringOption(o => o.setName('ten').setDescription('Tên phiên tự động').setRequired(false))
      .addIntegerOption(o => o.setName('tu_dong_dong').setDescription('Tự động đóng sau X phút (0 = không)').setRequired(false).setMinValue(0))
    )
    .addSubcommand(s => s
      .setName('xoa')
      .setDescription('Xóa một lịch cố định')
      .addIntegerOption(o => o.setName('index').setDescription('Số thứ tự (xem /lichcodinh xem)').setRequired(true).setMinValue(1))
    )
    .addSubcommand(s => s.setName('xoa_tat_ca').setDescription('Xóa toàn bộ lịch cố định')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;
    const sub = interaction.options.getSubcommand();
    const cfg = await db.getGuildConfig(guild.id);
    let schedules = cfg.schedules ?? [];

    const DAY_NAMES = ['CN','T2','T3','T4','T5','T6','T7'];
    function fmtSchedule(s, i) {
      return `**${i+1}.** ${DAY_NAMES[parseInt(s.day)]} ${String(s.hour).padStart(2,'0')}:${String(s.minute).padStart(2,'0')} — ${s.name ?? 'Điểm danh'}`;
    }

    if (sub === 'xem') {
      const embed = new EmbedBuilder().setColor(0x01696f).setTitle('📅 Lịch Cố Định')
        .setDescription(schedules.length ? schedules.map(fmtSchedule).join('\n') : '_Chưa có lịch nào_');
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'them') {
      const entry = {
        day:   parseInt(interaction.options.getString('thu')),
        hour:  interaction.options.getInteger('gio'),
        minute: interaction.options.getInteger('phut'),
        name:  interaction.options.getString('ten') ?? null,
        auto_close_min: interaction.options.getInteger('tu_dong_dong') ?? 0,
      };
      schedules.push(entry);
      await db.setGuildConfig(guild.id, { schedules });
      return interaction.editReply({ content: `✅ Đã thêm lịch: ${DAY_NAMES[entry.day]} ${String(entry.hour).padStart(2,'0')}:${String(entry.minute).padStart(2,'0')}` });
    }

    if (sub === 'xoa') {
      const idx = interaction.options.getInteger('index') - 1;
      if (idx < 0 || idx >= schedules.length) return interaction.editReply({ content: '⚠️ Số thứ tự không hợp lệ.' });
      schedules.splice(idx, 1);
      await db.setGuildConfig(guild.id, { schedules });
      return interaction.editReply({ content: '✅ Đã xóa lịch.' });
    }

    if (sub === 'xoa_tat_ca') {
      await db.setGuildConfig(guild.id, { schedules: [] });
      return interaction.editReply({ content: '✅ Đã xóa toàn bộ lịch cố định.' });
    }
  },
};
// ── Sapphire wrapper ──────────────────────────────────────────────────────────
const _origModule = module.exports;
class LichcodinhCommand extends Command {
  constructor(context) { super(context, { name: _origModule.data.name, description: _origModule.data.description, preconditions: ['AdminOnly'] }); }
  registerApplicationCommands(registry) { registry.registerChatInputCommand(_origModule.data); }
  async chatInputRun(interaction) { return _origModule.execute(interaction); }
}
module.exports = { LichcodinhCommand };
