// handlers/setup/reminderHandler.js — setup:reminder, setup:reminder:*
'use strict';
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const db = require('../../db.js');
const { FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('../../utils/embeds.js');
const { buildDashboard } = require('./dashboardHandler.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Lấy reminder config từ guild_config (lưu trong field reminder_config jsonb) */
async function getReminderCfg(guildId) {
  const cfg = await db.getConfig(guildId);
  return cfg?.reminder_config ?? { enabled: false, minutes_before: 15, message: '⏰ Sắp có phiên điểm danh!' };
}

/** Build embed hiển thị trạng thái reminder hiện tại */
function buildReminderEmbed(rcfg) {
  const statusLine = rcfg.enabled
    ? `🟢 **Bật** — nhắc trước **${rcfg.minutes_before} phút**`
    : '🔴 **Tắt**';
  return new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle('⏰ Cài đặt Reminder')
    .setDescription([
      `**Trạng thái:** ${statusLine}`,
      `**Tin nhắn:** ${rcfg.message ?? '_Mặc định_'}`,
      '',
      '> Reminder sẽ tự động gửi vào kênh thông báo trước giờ mở phiên lịch cố định.',
    ].join('\n'))
    .setColor(rcfg.enabled ? 0x57F287 : 0xED4245)
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();
}

/** Build các nút điều khiển reminder */
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

  // ── Menu chính ──────────────────────────────────────────────────────────────
  if (customId === 'setup:reminder') {
    await interaction.deferUpdate();
    const rcfg = await getReminderCfg(guild.id);
    await interaction.editReply({
      embeds: [buildReminderEmbed(rcfg)],
      components: buildReminderRows(rcfg),
    });
    return true;
  }

  // ── Toggle bật/tắt ──────────────────────────────────────────────────────────
  if (customId === 'setup:reminder:toggle') {
    await interaction.deferUpdate();
    const rcfg = await getReminderCfg(guild.id);
    rcfg.enabled = !rcfg.enabled;
    await db.updateConfig(guild.id, { reminder_config: rcfg });
    const statusWord = rcfg.enabled ? 'bật' : 'tắt';
    await interaction.editReply({
      content: `✅ Đã **${statusWord}** reminder.`,
      embeds: [buildReminderEmbed(rcfg)],
      components: buildReminderRows(rcfg),
    });
    return true;
  }

  // ── Chọn thời gian nhắc (select menu) ───────────────────────────────────────
  if (customId === 'setup:reminder:time') {
    await interaction.deferUpdate();
    const options = [5, 10, 15, 20, 30, 45, 60].map(m => ({
      label: `${m} phút trước`,
      value: String(m),
      description: `Nhắc trước ${m} phút`,
    }));
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup:reminder:time:select')
        .setPlaceholder('Chọn thời gian nhắc...')
        .setMinValues(1).setMaxValues(1)
        .addOptions(options),
    );
    const embed = new EmbedBuilder()
      .setAuthor(AUTHOR_DEFAULT)
      .setTitle('⏱️ Chọn thời gian nhắc')
      .setDescription('Bot sẽ gửi reminder trước giờ mở phiên bao nhiêu phút?')
      .setColor(0x5865F2).setFooter({ text: FOOTER_DEFAULT });
    await interaction.editReply({ embeds: [embed], components: [row] });
    return true;
  }

  if (customId === 'setup:reminder:time:select') {
    await interaction.deferUpdate();
    const minutes = parseInt(interaction.values[0], 10);
    const rcfg = await getReminderCfg(guild.id);
    rcfg.minutes_before = minutes;
    await db.updateConfig(guild.id, { reminder_config: rcfg });
    await interaction.editReply({
      content: `✅ Đã cài nhắc trước **${minutes} phút**.`,
      embeds: [buildReminderEmbed(rcfg)],
      components: buildReminderRows(rcfg),
    });
    return true;
  }

  // ── Sửa tin nhắn reminder (modal) ───────────────────────────────────────────
  if (customId === 'setup:reminder:message') {
    const rcfg = await getReminderCfg(guild.id);
    const modal = new ModalBuilder()
      .setCustomId('setup:reminder:message:submit')
      .setTitle('✏️ Tin nhắn Reminder');
    const input = new TextInputBuilder()
      .setCustomId('reminder_msg')
      .setLabel('Nội dung tin nhắn')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('⏰ Sắp có phiên điểm danh!')
      .setValue(rcfg.message ?? '⏰ Sắp có phiên điểm danh!')
      .setMaxLength(500)
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
    return true;
  }

  if (customId === 'setup:reminder:message:submit') {
    await interaction.deferUpdate();
    const newMsg = interaction.fields.getTextInputValue('reminder_msg').trim();
    const rcfg = await getReminderCfg(guild.id);
    rcfg.message = newMsg;
    await db.updateConfig(guild.id, { reminder_config: rcfg });
    await interaction.editReply({
      content: '✅ Đã cập nhật tin nhắn reminder.',
      embeds: [buildReminderEmbed(rcfg)],
      components: buildReminderRows(rcfg),
    });
    return true;
  }

  return false;
}

module.exports = { handleReminder };
