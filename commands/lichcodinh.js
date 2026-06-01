'use strict';
// commands/lichcodinh.js — migrate sang scheduled_sessions
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { Command } = require('@sapphire/framework');
const db = require('../db.js');

const DAY_OPTIONS = [
  { name: 'Thứ 2', value: '1' }, { name: 'Thứ 3', value: '2' },
  { name: 'Thứ 4', value: '3' }, { name: 'Thứ 5', value: '4' },
  { name: 'Thứ 6', value: '5' }, { name: 'Thứ 7', value: '6' },
  { name: 'Chủ nhật', value: '0' },
];
const DAY_NAMES = ['CN','T2','T3','T4','T5','T6','T7'];

const slashData = new SlashCommandBuilder()
  .setName('lichcodinh')
  .setDescription('Quản lý lịch điểm danh cố định tự động')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(s => s.setName('xem').setDescription('Xem danh sách lịch hiện tại'))
  .addSubcommand(s => s
    .setName('them')
    .setDescription('Thêm lịch cố định mới')
    .addStringOption(o => o.setName('thu').setDescription('Thứ trong tuần (mở phiên)').setRequired(true).addChoices(...DAY_OPTIONS))
    .addIntegerOption(o => o.setName('gio').setDescription('Giờ mở (0-23)').setRequired(true).setMinValue(0).setMaxValue(23))
    .addIntegerOption(o => o.setName('phut').setDescription('Phút mở (0-59)').setRequired(true).setMinValue(0).setMaxValue(59))
    .addStringOption(o => o.setName('ten').setDescription('Tên phiên').setRequired(false))
    .addStringOption(o => o.setName('thu_dong').setDescription('Thứ tự động đóng').setRequired(false).addChoices(...DAY_OPTIONS))
    .addIntegerOption(o => o.setName('gio_dong').setDescription('Giờ đóng (0-23)').setRequired(false).setMinValue(0).setMaxValue(23))
    .addIntegerOption(o => o.setName('phut_dong').setDescription('Phút đóng (0-59)').setRequired(false).setMinValue(0).setMaxValue(59))
    .addIntegerOption(o => o.setName('nhac_1').setDescription('Nhắc trước X phút (lần 1, mặc định 30)').setRequired(false).setMinValue(1).setMaxValue(240))
    .addIntegerOption(o => o.setName('nhac_2').setDescription('Nhắc trước X phút (lần 2, mặc định 10)').setRequired(false).setMinValue(1).setMaxValue(240))
    .addRoleOption(o => o.setName('role').setDescription('Giới hạn role được điểm danh').setRequired(false))
  )
  .addSubcommand(s => s
    .setName('xoa')
    .setDescription('Xóa một lịch cố định')
    .addIntegerOption(o => o.setName('index').setDescription('Số thứ tự (xem /lichcodinh xem)').setRequired(true).setMinValue(1))
  )
  .addSubcommand(s => s
    .setName('skip')
    .setDescription('Bỏ qua phiên tuần này của một lịch')
    .addIntegerOption(o => o.setName('index').setDescription('Số thứ tự (xem /lichcodinh xem)').setRequired(true).setMinValue(1))
  );

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const { guild } = interaction;
  const sub = interaction.options.getSubcommand();

  // ── xem ───────────────────────────────────────────────────────────────────
  if (sub === 'xem') {
    const list = await db.getScheduledSessions(guild.id);
    const desc = list.length
      ? list.map((s, i) => {
          const open  = `${DAY_NAMES[s.day_of_week]} ${String(s.hour).padStart(2,'0')}:${String(s.minute).padStart(2,'0')}`;
          const close = s.close_hour != null
            ? ` → ${DAY_NAMES[s.close_day_of_week ?? s.day_of_week]} ${String(s.close_hour).padStart(2,'0')}:${String(s.close_minute).padStart(2,'0')}`
            : '';
          const remind = s.reminder_enabled ? ` 🔔 ${s.reminder_1_min}/${s.reminder_2_min}ph` : '';
          return `**${i+1}.** ${open}${close} — ${s.session_name}${remind}`;
        }).join('\n')
      : '_Chưa có lịch nào_';
    const embed = new EmbedBuilder()
      .setColor(0x01696f)
      .setTitle('📅 Lịch Cố Định')
      .setDescription(desc)
      .setFooter({ text: 'Dùng /lichcodinh them để thêm lịch mới' });
    return interaction.editReply({ embeds: [embed] });
  }

  // ── them ──────────────────────────────────────────────────────────────────
  if (sub === 'them') {
    const cfg = await db.getGuildConfig(guild.id);
    const channelId = cfg?.channel_id;
    if (!channelId) return interaction.editReply({ content: '⚠️ Chưa cài đặt kênh điểm danh. Dùng `/setup` trước.' });

    const entry = await db.themLichCoDinh(guild.id, {
      dayOfWeek:       parseInt(interaction.options.getString('thu')),
      hour:            interaction.options.getInteger('gio'),
      minute:          interaction.options.getInteger('phut'),
      sessionName:     interaction.options.getString('ten') ?? 'Điểm danh',
      closeDayOfWeek:  interaction.options.getString('thu_dong') != null ? parseInt(interaction.options.getString('thu_dong')) : null,
      closeHour:       interaction.options.getInteger('gio_dong'),
      closeMinute:     interaction.options.getInteger('phut_dong'),
      reminder1Min:    interaction.options.getInteger('nhac_1') ?? 30,
      reminder2Min:    interaction.options.getInteger('nhac_2') ?? 10,
      allowedRoleId:   interaction.options.getRole('role')?.id ?? null,
      channelId,
    });
    const open = `${DAY_NAMES[entry.day_of_week]} ${String(entry.hour).padStart(2,'0')}:${String(entry.minute).padStart(2,'0')}`;
    return interaction.editReply({ content: `✅ Đã thêm lịch **${entry.session_name}** — ${open}` });
  }

  // ── xoa ───────────────────────────────────────────────────────────────────
  if (sub === 'xoa') {
    const list = await db.getScheduledSessions(guild.id);
    const idx  = interaction.options.getInteger('index') - 1;
    if (idx < 0 || idx >= list.length) return interaction.editReply({ content: '⚠️ Số thứ tự không hợp lệ.' });
    await db.deleteScheduledSession(list[idx].id);
    return interaction.editReply({ content: `✅ Đã xóa lịch **${list[idx].session_name}**.` });
  }

  // ── skip ──────────────────────────────────────────────────────────────────
  if (sub === 'skip') {
    const list = await db.getScheduledSessions(guild.id);
    const idx  = interaction.options.getInteger('index') - 1;
    if (idx < 0 || idx >= list.length) return interaction.editReply({ content: '⚠️ Số thứ tự không hợp lệ.' });
    // skip đến 8 ngày sau để chắc chắn qua 1 chu kỳ tuần
    const skipUntil = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();
    await db.skipScheduledSession(list[idx].id, skipUntil);
    return interaction.editReply({ content: `⏭️ Đã bỏ qua phiên **${list[idx].session_name}** tuần này.` });
  }
}

const _data = { data: slashData, execute };

class LichcodinhCommand extends Command {
  constructor(context) {
    super(context, { name: slashData.name, description: slashData.description, preconditions: ['AdminOnly'] });
  }
  registerApplicationCommands(registry) { registry.registerChatInputCommand(slashData); }
  async chatInputRun(interaction) { return execute(interaction); }
}

module.exports = { LichcodinhCommand };
