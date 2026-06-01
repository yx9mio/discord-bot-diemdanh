// handlers/setup/reminderHandler.js — setup:reminder, setup:reminder:*
'use strict';
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const db = require('../../db.js');
const { FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('../../utils/embeds.js');
const { buildDashboard } = require('./dashboardHandler.js');

const DEFAULT_TZ = 'Asia/Ho_Chi_Minh';

// Danh sách timezone phổ biến cho select menu
const TIMEZONE_OPTIONS = [
  { label: 'Việt Nam (UTC+7)',        value: 'Asia/Ho_Chi_Minh' },
  { label: 'Thái Lan / Indonesia W (UTC+7)', value: 'Asia/Bangkok' },
  { label: 'Singapore / MY / PH (UTC+8)', value: 'Asia/Singapore' },
  { label: 'Nhật Bản / Hàn Quốc (UTC+9)', value: 'Asia/Tokyo' },
  { label: 'Trung Quốc (UTC+8)',      value: 'Asia/Shanghai' },
  { label: 'India (UTC+5:30)',          value: 'Asia/Kolkata' },
  { label: 'UK (UTC+0/+1)',             value: 'Europe/London' },
  { label: 'Central Europe (UTC+1/+2)', value: 'Europe/Berlin' },
  { label: 'US Eastern (UTC-5/-4)',     value: 'America/New_York' },
  { label: 'US Pacific (UTC-8/-7)',     value: 'America/Los_Angeles' },
  { label: 'Australia Eastern (UTC+10/+11)', value: 'Australia/Sydney' },
  { label: 'UTC±0',                    value: 'UTC' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getReminderCfg(guildId) {
  const cfg = await db.getConfig(guildId);
  return {
    rcfg: cfg?.reminder_config ?? { enabled: false, minutes_before: 15, message: '⏰ Sắp có phiên điểm danh!' },
    tz:   cfg?.timezone ?? DEFAULT_TZ,
  };
}

function buildReminderEmbed(rcfg, tz) {
  const statusLine = rcfg.enabled
    ? `🟢 **Bật** — nhắc trước **${rcfg.minutes_before} phút**`
    : '🔴 **Tắt**';
  const tzOption = TIMEZONE_OPTIONS.find(o => o.value === tz);
  return new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle('⏰ Cài đặt Reminder')
    .setDescription([
      `**Trạng thái:** ${statusLine}`,
      `**Tin nhắn:** ${rcfg.message ?? '_Mặc định_'}`,
      `**Timezone:** ${tzOption?.label ?? tz}`,
      '',
      '> Reminder tự động gửi vào kênh thông báo trước giờ mở phiên lịch cố định.',
    ].join('\n'))
    .setColor(rcfg.enabled ? 0x57F287 : 0xED4245)
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();
}

function buildReminderRows(rcfg) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup:reminder:toggle')
      .setLabel(rcfg.enabled ? '🔴 Tắt Reminder' : '🟢 Bật Reminder')
      .setStyle(rcfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('setup:reminder:time')
      .setLabel('⏱️ Thời gian nhắc')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup:reminder:message')
      .setLabel('✏️ Sửa tin nhắn')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup:reminder:timezone')
      .setLabel('🌏 Timezone')
      .setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup:dashboard')
      .setLabel('◀ Quay lại Dashboard')
      .setStyle(ButtonStyle.Secondary),
  );
  return [row1, row2];
}

// ── Handler ───────────────────────────────────────────────────────────────────

async function handleReminder(interaction) {
  const { customId, guild } = interaction;
  if (!customId.startsWith('setup:reminder')) return false;

  // ── Menu chính ──
  if (customId === 'setup:reminder') {
    await interaction.deferUpdate();
    const { rcfg, tz } = await getReminderCfg(guild.id);
    await interaction.editReply({
      embeds: [buildReminderEmbed(rcfg, tz)],
      components: buildReminderRows(rcfg),
    });
    return true;
  }

  // ── Toggle bật/tắt ──
  if (customId === 'setup:reminder:toggle') {
    await interaction.deferUpdate();
    const { rcfg, tz } = await getReminderCfg(guild.id);
    rcfg.enabled = !rcfg.enabled;
    await db.updateConfig(guild.id, { reminder_config: rcfg });
    await interaction.editReply({
      content: `✅ Đã **${rcfg.enabled ? 'bật' : 'tắt'}** reminder.`,
      embeds: [buildReminderEmbed(rcfg, tz)],
      components: buildReminderRows(rcfg),
    });
    return true;
  }

  // ── Chọn thời gian nhắc ──
  if (customId === 'setup:reminder:time') {
    await interaction.deferUpdate();
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup:reminder:time:select')
        .setPlaceholder('Chọn thời gian nhắc...')
        .setMinValues(1).setMaxValues(1)
        .addOptions([5,10,15,20,30,45,60].map(m => ({
          label: `${m} phút trước`,
          value: String(m),
          description: `Nhắc trước ${m} phút`,
        }))),
    );
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setAuthor(AUTHOR_DEFAULT)
        .setTitle('⏱️ Chọn thời gian nhắc')
        .setDescription('Bot sẽ gửi reminder trước giờ mở phiên bao nhiêu phút?')
        .setColor(0x5865F2).setFooter({ text: FOOTER_DEFAULT })],
      components: [row],
    });
    return true;
  }

  if (customId === 'setup:reminder:time:select') {
    await interaction.deferUpdate();
    const minutes = parseInt(interaction.values[0], 10);
    const { rcfg, tz } = await getReminderCfg(guild.id);
    rcfg.minutes_before = minutes;
    await db.updateConfig(guild.id, { reminder_config: rcfg });
    await interaction.editReply({
      content: `✅ Đã cài nhắc trước **${minutes} phút**.`,
      embeds: [buildReminderEmbed(rcfg, tz)],
      components: buildReminderRows(rcfg),
    });
    return true;
  }

  // ── Sửa tin nhắn (modal) ──
  if (customId === 'setup:reminder:message') {
    const { rcfg } = await getReminderCfg(guild.id);
    const modal = new ModalBuilder()
      .setCustomId('setup:reminder:message:submit')
      .setTitle('✏️ Tin nhắn Reminder');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('reminder_msg')
        .setLabel('Nội dung tin nhắn')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('⏰ Sắp có phiên điểm danh!')
        .setValue(rcfg.message ?? '⏰ Sắp có phiên điểm danh!')
        .setMaxLength(500).setRequired(true),
    ));
    await interaction.showModal(modal);
    return true;
  }

  if (customId === 'setup:reminder:message:submit') {
    await interaction.deferUpdate();
    const newMsg = interaction.fields.getTextInputValue('reminder_msg').trim();
    const { rcfg, tz } = await getReminderCfg(guild.id);
    rcfg.message = newMsg;
    await db.updateConfig(guild.id, { reminder_config: rcfg });
    await interaction.editReply({
      content: '✅ Đã cập nhật tin nhắn reminder.',
      embeds: [buildReminderEmbed(rcfg, tz)],
      components: buildReminderRows(rcfg),
    });
    return true;
  }

  // ── Chọn timezone ──
  if (customId === 'setup:reminder:timezone') {
    await interaction.deferUpdate();
    const { tz } = await getReminderCfg(guild.id);
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup:reminder:timezone:select')
        .setPlaceholder('Chọn timezone...')
        .setMinValues(1).setMaxValues(1)
        .addOptions(TIMEZONE_OPTIONS.map(o => ({
          ...o,
          default: o.value === tz,
        }))),
    );
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setAuthor(AUTHOR_DEFAULT)
        .setTitle('🌏 Chọn Timezone')
        .setDescription([
          'Chọn timezone phù hợp với guild.',
          `**Hiện tại:** \`${tz}\``,
          '',
          '> Timezone ảnh hưởng đến cả reminder lịch cố định và giờ mở phiên tự động.',
        ].join('\n'))
        .setColor(0x5865F2).setFooter({ text: FOOTER_DEFAULT })],
      components: [row],
    });
    return true;
  }

  if (customId === 'setup:reminder:timezone:select') {
    await interaction.deferUpdate();
    const newTz = interaction.values[0];
    // Validate IANA
    try { Intl.DateTimeFormat(undefined, { timeZone: newTz }); } catch {
      await interaction.editReply({ content: '❌ Timezone không hợp lệ.' });
      return true;
    }
    await db.updateConfig(guild.id, { timezone: newTz });
    const { rcfg } = await getReminderCfg(guild.id);
    const tzOption = TIMEZONE_OPTIONS.find(o => o.value === newTz);
    await interaction.editReply({
      content: `✅ Đã cài timezone: **${tzOption?.label ?? newTz}**`,
      embeds: [buildReminderEmbed(rcfg, newTz)],
      components: buildReminderRows(rcfg),
    });
    return true;
  }

  return false;
}

module.exports = { handleReminder };
