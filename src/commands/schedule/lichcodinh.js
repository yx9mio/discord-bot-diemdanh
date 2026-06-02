// src/commands/schedule/lichcodinh.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../db.js');
const { FOOTER_DEFAULT, replyConfirm, replyErr } = require('../../../utils/embeds.js');

const DAY_VI = ['CN','T2','T3','T4','T5','T6','T7'];
const fmt = s => `${DAY_VI[s.day_of_week]} ${String(s.hour).padStart(2,'0')}:${String(s.minute).padStart(2,'0')}`;

function buildLichcdEmbed(schedules, autoEnabled) {
  const embed = new EmbedBuilder().setColor(0x01696f).setTitle('📅 Lịch điểm danh cố định');
  if (!schedules.length) {
    embed.setDescription('_Chưa có lịch nào. Dùng `/lichcodinh them` để thêm._');
  } else {
    embed.setDescription(schedules.map((s, i) =>
      `**${i + 1}.** ${fmt(s)} — ${s.session_name ?? 'Auto'}`
    ).join('\n'));
  }
  embed.addFields({ name: '🔔 Tự động', value: autoEnabled ? '✅ Đang bật' : '❌ Tắt', inline: true });
  embed.setFooter({ text: `${FOOTER_DEFAULT} · Bấm ✕ để xóa từng dòng · /lichcodinh xoa_tat_ca để xóa hết` });
  return embed;
}

function buildScheduleDeleteRows(schedules) {
  if (!schedules.length) return [];
  const rows = [];
  let row = new ActionRowBuilder();
  for (let i = 0; i < schedules.length; i++) {
    if (i > 0 && i % 5 === 0) { rows.push(row); row = new ActionRowBuilder(); }
    const s = schedules[i];
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`lichcd:del:${i}`)
        .setLabel(`✕ ${i + 1}. ${fmt(s)}`)
        .setStyle(ButtonStyle.Danger),
    );
  }
  rows.push(row);
  return rows.slice(0, 5);
}

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
      const embed = buildLichcdEmbed(schedules, cfg.auto_schedule_enabled);
      const rows  = buildScheduleDeleteRows(schedules);
      return interaction.editReply({ embeds: [embed], components: rows });
    }

    if (sub === 'them') {
      const entry = {
        day_of_week:  interaction.options.getInteger('thu'),
        hour:         interaction.options.getInteger('gio'),
        minute:       interaction.options.getInteger('phut'),
        session_name: interaction.options.getString('ten') ?? null,
      };
      const dup = schedules.find(s =>
        s.day_of_week === entry.day_of_week &&
        s.hour === entry.hour &&
        s.minute === entry.minute,
      );
      if (dup) {
        return interaction.editReply(replyErr(`Lịch ${fmt(entry)} đã tồn tại. Dùng \`/lichcodinh xoa\` hoặc bấm nút ✕ trong \`/lichcodinh xem\`.`));
      }
      schedules.push(entry);
      await db.setGuildConfig(guild.id, { schedules });
      return interaction.editReply({ content: `✅ Đã thêm lịch: ${fmt(entry)}` });
    }

    if (sub === 'xoa') {
      const idx = interaction.options.getInteger('index') - 1;
      if (idx < 0 || idx >= schedules.length) return interaction.editReply(replyErr('Index không hợp lệ.'));
      schedules.splice(idx, 1);
      await db.setGuildConfig(guild.id, { schedules });
      return interaction.editReply({ content: '✅ Đã xóa lịch.' });
    }

    if (sub === 'xoa_tat_ca') {
      if (!schedules.length) return interaction.editReply({ content: '📭 Chưa có lịch nào để xóa.' });
      return interaction.editReply(
        replyConfirm(
          `Xóa toàn bộ **${schedules.length} lịch** cố định?\n> Bot sẽ không tự động tạo phiên theo lịch cho đến khi bạn thêm lại.`,
          'lichcd:delall:confirm',
          'lichcd:delall:cancel',
        ),
      );
    }

    if (sub === 'bat_tat') {
      const enabled = interaction.options.getBoolean('kich_hoat');
      await db.setGuildConfig(guild.id, { auto_schedule_enabled: enabled });
      return interaction.editReply({ content: `✅ Tự động tạo phiên: ${enabled ? '**bật**' : '**tắt**'}.` });
    }
  }
}

module.exports = { LichCoDinhCommand, buildScheduleDeleteRows, buildLichcdEmbed };
