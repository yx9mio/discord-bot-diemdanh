// src/commands/schedule/lichcodinh.js
// Lệnh /lichcodinh — đã được refactor dùng bảng scheduled_sessions
// (Commit 2: drop JSON schedules cũ). Sẽ bị xoá ở Commit 6 khi wizard
// /setup thay thế hoàn toàn. Giữ tạm để không break người dùng hiện tại.
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../db.js');
const { FOOTER_DEFAULT, replyConfirm, replyErr } = require('../../../utils/embeds.js');

const DAY_VI = ['CN','T2','T3','T4','T5','T6','T7'];
const fmt = s => `${DAY_VI[s.day_of_week]} ${String(s.hour).padStart(2,'0')}:${String(s.minute).padStart(2,'0')}`;

function buildLichcdEmbed(schedules) {
  const embed = new EmbedBuilder().setColor(0x01696f).setTitle('📅 Lịch điểm danh cố định');
  if (!schedules.length) {
    embed.setDescription('_Chưa có lịch nào. Dùng `/lichcodinh them` để thêm._');
  } else {
    embed.setDescription(schedules.map((s, i) => {
      const moLine = `${fmt(s)} — ${s.session_name ?? 'Auto'}`;
      const pc = s.pre_close_minutes ? ` · ⏱️ đóng DD trước ${s.pre_close_minutes}p` : '';
      return `**${i + 1}.** ${moLine}${pc}`;
    }).join('\n'));
  }
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
        .setCustomId(`lichcd:del:${s.id}`)
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
          .addIntegerOption(o => o.setName('pre_close').setDescription('Đóng DD trước bao nhiêu phút (0-180, mặc định 30)').setRequired(false).setMinValue(0).setMaxValue(180))
        )
        .addSubcommand(s => s
          .setName('xoa')
          .setDescription('Xóa lịch theo index')
          .addIntegerOption(o => o.setName('index').setDescription('Số thứ tự (xem bằng /lichcodinh xem)').setRequired(true).setMinValue(1))
        )
        .addSubcommand(s => s.setName('xoa_tat_ca').setDescription('Xóa tất cả lịch cố định'))
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub  = interaction.options.getSubcommand();
    const { guild } = interaction;

    if (sub === 'xem') {
      const schedules = await db.getScheduledSessions(guild.id);
      const embed = buildLichcdEmbed(schedules);
      const rows  = buildScheduleDeleteRows(schedules);
      return interaction.editReply({ embeds: [embed], components: rows });
    }

    if (sub === 'them') {
      const dayOfWeek   = interaction.options.getInteger('thu');
      const hour        = interaction.options.getInteger('gio');
      const minute      = interaction.options.getInteger('phut');
      const sessionName = interaction.options.getString('ten');
      const preClose    = interaction.options.getInteger('pre_close') ?? 30;
      const cfg = await db.getGuildConfig(guild.id);
      const channelId = cfg?.log_channel_id ?? cfg?.channel_id;
      if (!channelId) {
        return interaction.editReply(replyErr('Chưa cấu hình kênh mặc định. Dùng `/caidat` (hoặc `/setup`) để cài trước.'));
      }
      const existing = await db.getScheduledSessions(guild.id);
      const dup = existing.find(s => s.day_of_week === dayOfWeek && s.hour === hour && s.minute === minute);
      if (dup) {
        return interaction.editReply(replyErr(`Lịch ${DAY_VI[dayOfWeek]} ${hour}:${String(minute).padStart(2,'0')} đã tồn tại. Dùng \`/lichcodinh xoa\` hoặc bấm nút ✕ trong \`/lichcodinh xem\`.`));
      }
      await db.themLichCoDinh(guild.id, {
        dayOfWeek, hour, minute,
        sessionName: sessionName ?? 'Diểm danh',
        preCloseMinutes: preClose,
        channelId,
      });
      return interaction.editReply({ content: `✅ Đã thêm lịch: ${DAY_VI[dayOfWeek]} ${hour}:${String(minute).padStart(2,'0')} — **${sessionName ?? 'Diểm danh'}**${preClose ? ` (đóng DD trước ${preClose}p)` : ''}` });
    }

    if (sub === 'xoa') {
      const idx = interaction.options.getInteger('index') - 1;
      const existing = await db.getScheduledSessions(guild.id);
      if (idx < 0 || idx >= existing.length) return interaction.editReply(replyErr('Index không hợp lệ.'));
      const target = existing[idx];
      await db.deleteScheduledSession(target.id);
      return interaction.editReply({ content: `✅ Đã xóa lịch: ${fmt(target)}` });
    }

    if (sub === 'xoa_tat_ca') {
      const existing = await db.getScheduledSessions(guild.id);
      if (!existing.length) return interaction.editReply({ content: '📭 Chưa có lịch nào để xóa.' });
      return interaction.editReply(
        replyConfirm(
          `Xóa toàn bộ **${existing.length} lịch** cố định?\n> Bot sẽ không tự động tạo phiên theo lịch cho đến khi bạn thêm lại.`,
          'lichcd:delall:confirm',
          'lichcd:delall:cancel',
        ),
      );
    }
  }
}

module.exports = { LichCoDinhCommand, buildScheduleDeleteRows, buildLichcdEmbed };
