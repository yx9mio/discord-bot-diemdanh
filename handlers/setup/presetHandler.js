// handlers/setup/presetHandler.js — setup:preset_menu, setup:preset:select, createPresetLich
'use strict';
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ChannelSelectMenuBuilder,
} = require('discord.js');
const db = require('../../db.js');
const { FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('../../utils/embeds.js');
const { PRESETS, pad, ngayThucTe } = require('./helpers.js');
const { buildDashboard } = require('./dashboardHandler.js');

async function createPresetLich(interaction, guild, preset, channelId) {
  const cfg         = await db.getConfig(guild.id);
  const phaiRoleIds = cfg.phai_role_ids ?? [];
  const d           = preset.data;
  const lich = await db.themLichCoDinh(guild.id, {
    dayOfWeek:      d.day_of_week,  hour:           d.hour,  minute:         d.minute,
    sessionName:    preset.label.replace(/^[^a-zA-ZÀ-ỹ0-9]+/, '').trim(),
    closeDayOfWeek: d.close_day_of_week ?? null,
    closeHour:      d.close_hour ?? null,
    closeMinute:    d.close_minute ?? null,
    phaiRoleIds,
    channelId,
  });
  const { scheduleLichCoDinh } = require('../../utils/scheduler.js');
  await scheduleLichCoDinh(interaction.client, guild, lich);
  const cfgFresh = await db.getConfig(guild.id);
  const payload  = await buildDashboard(guild, cfgFresh, 'admin');
  const { label: moLabel }   = ngayThucTe(d.day_of_week, d.hour, d.minute);
  const { label: dongLabel, note: dongNote } = ngayThucTe(
    d.close_day_of_week, d.close_hour, d.close_minute, d.day_of_week, d.hour, d.minute,
  );
  const dongDisplay = dongNote ? `${dongLabel} ${dongNote}` : dongLabel;
  payload.content = [
    `⚡ Đã tạo preset **${preset.label}**!`,
    `Mở: **${moLabel}** → Đóng: **${dongDisplay}**`,
    `Kênh: <#${channelId}> | ID: \`${lich.id}\``,
  ].join('\n');
  if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
  else await interaction.followUp({ ...payload, ephemeral: true });
}

async function handlePreset(interaction) {
  const { customId, guild } = interaction;

  if (customId === 'setup:preset_menu') {
    await interaction.deferUpdate();
    const embed = new EmbedBuilder()
      .setAuthor(AUTHOR_DEFAULT)
      .setTitle('⚡ Tạo Lịch Từ Preset')
      .setDescription('Chọn mẫu lịch có sẵn để tạo nhanh.')
      .setColor(0x57F287).setFooter({ text: FOOTER_DEFAULT });
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup:preset:select')
        .setPlaceholder('Chọn preset...')
        .addOptions(PRESETS.map(p => ({ label: p.label, value: p.value, description: p.description }))),
    );
    await interaction.editReply({ embeds: [embed], components: [row], ephemeral: true });
    return true;
  }

  if (customId === 'setup:preset:select') {
    await interaction.deferUpdate();
    const value  = interaction.values[0];
    const preset = PRESETS.find(p => p.value === value);
    if (!preset) { await interaction.editReply({ content: '❌ Preset không tồn tại.' }); return true; }
    if (!preset.data) {
      // Tùy chỉnh → show lịch menu add
      const { handleShowAddModal } = require('./lichHandler.js');
      // Cannot showModal after deferUpdate — send prompt instead
      await interaction.editReply({
        content: '✏️ Chọn **➕ Thêm mới** trong màn hình Quản lý Lịch để nhập tay.',
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('setup:lich:menu').setLabel('📅 Quản lý Lịch').setStyle(ButtonStyle.Primary),
        )],
        ephemeral: true,
      });
      return true;
    }
    // Preset có channel riêng → hỏi kênh
    const embed = new EmbedBuilder()
      .setAuthor(AUTHOR_DEFAULT)
      .setTitle(`⚡ Preset: ${preset.label}`)
      .setDescription(`${preset.description}\n\nChọn kênh để bot gửi thông báo cho lịch này.`)
      .setColor(0x57F287).setFooter({ text: FOOTER_DEFAULT });
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId(`setup:preset:kenh:${value}`)
        .setPlaceholder('Chọn kênh...')
        .setMinValues(1).setMaxValues(1),
    );
    await interaction.editReply({ embeds: [embed], components: [row], ephemeral: true });
    return true;
  }

  if (customId.startsWith('setup:preset:kenh:')) {
    const presetValue = customId.replace('setup:preset:kenh:', '');
    await interaction.deferUpdate();
    const channelId = interaction.values[0];
    const preset    = PRESETS.find(p => p.value === presetValue);
    if (!preset?.data) { await interaction.editReply({ content: '❌ Preset không hợp lệ.' }); return true; }
    // Save button
    const embed = new EmbedBuilder()
      .setTitle(`⚡ Xác nhận tạo: ${preset.label}`)
      .setDescription(`Kênh: <#${channelId}>\n${preset.description}`)
      .setColor(0x57F287).setFooter({ text: FOOTER_DEFAULT });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`setup:preset_bc:save:${presetValue}:${channelId}`)
        .setLabel('✅ Tạo lịch').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('setup:preset_menu')
        .setLabel('← Chọn lại').setStyle(ButtonStyle.Secondary),
    );
    await interaction.editReply({ embeds: [embed], components: [row], ephemeral: true });
    return true;
  }

  if (customId.startsWith('setup:preset_bc:save:')) {
    const parts      = customId.replace('setup:preset_bc:save:', '').split(':');
    const presetValue = parts[0];
    const channelId  = parts[1];
    await interaction.deferUpdate();
    const preset = PRESETS.find(p => p.value === presetValue);
    if (!preset?.data) { await interaction.editReply({ content: '❌ Preset không hợp lệ.' }); return true; }
    await createPresetLich(interaction, guild, preset, channelId);
    return true;
  }

  return false;
}

module.exports = { handlePreset };
