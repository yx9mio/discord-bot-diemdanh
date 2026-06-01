// handlers/setup/presetHandler.js — quản lý preset phiên
'use strict';
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const db = require('../../db.js');
const { FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('../../utils/embeds.js');
const { PRESETS, ngayThucTe, buildPresetDescription } = require('./helpers.js');
const { buildDashboard } = require('./dashboardHandler.js');

// ─── Menu danh sách preset ────────────────────────────────────────────────────
function presetMenuComponents(presets) {
  const embed = new EmbedBuilder()
    .setAuthor({ name: AUTHOR_DEFAULT })
    .setColor(0x5865F2)
    .setTitle('📋 Quản lý Preset')
    .setDescription(
      presets.length === 0
        ? '_(Chưa có preset nào)_'
        : presets.map((p, i) => `**${i + 1}.** ${p.name} — ${buildPresetDescription(p)}`).join('\n'),
    )
    .setFooter({ text: FOOTER_DEFAULT });

  const rows = [];
  if (presets.length > 0) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('setup:preset:select')
          .setPlaceholder('Chọn preset để xem/sửa/xóa…')
          .addOptions(presets.map(p => ({ label: p.name.slice(0, 100), value: p.id }))),
      ),
    );
  }
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('setup:preset:add').setLabel('➕ Thêm').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('setup:dashboard').setLabel('↩ Quay lại').setStyle(ButtonStyle.Secondary),
    ),
  );

  return { embeds: [embed], components: rows };
}

// ─── Handle ───────────────────────────────────────────────────────────────────
async function handlePreset(interaction) {
  const { customId, guild } = interaction;

  if (customId === 'setup:preset:menu') {
    await interaction.deferUpdate().catch(() => {});
    const presets = await db.getPresets(guild.id);
    await interaction.editReply(presetMenuComponents(presets));
    return true;
  }

  if (customId === 'setup:preset:select') {
    const presetId = interaction.values[0];
    const presets  = await db.getPresets(guild.id);
    const preset   = presets.find(p => p.id === presetId);
    if (!preset) {
      await interaction.update({ content: '❌ Không tìm thấy preset.', embeds: [], components: [] });
      return true;
    }
    const embed = new EmbedBuilder()
      .setAuthor({ name: AUTHOR_DEFAULT })
      .setColor(0x5865F2)
      .setTitle(`📋 Preset: ${preset.name}`)
      .setDescription(buildPresetDescription(preset))
      .setFooter({ text: FOOTER_DEFAULT });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`setup:preset:edit:${presetId}`).setLabel('✏️ Sửa').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`setup:preset:delete:${presetId}`).setLabel('🗑️ Xóa').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('setup:preset:menu').setLabel('↩ Quay lại').setStyle(ButtonStyle.Secondary),
    );
    await interaction.update({ embeds: [embed], components: [row] });
    return true;
  }

  if (customId === 'setup:preset:add') {
    const builtIn = PRESETS.map(p => p.name).join(', ');
    const modal = new ModalBuilder()
      .setCustomId('setup:preset:add:modal')
      .setTitle('➕ Thêm Preset')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('name').setLabel('Tên preset').setStyle(TextInputStyle.Short).setPlaceholder(builtIn).setRequired(true).setMaxLength(80),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('duration').setLabel('Thời lượng (phút, để trống = không giới hạn)').setStyle(TextInputStyle.Short).setRequired(false),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('late_threshold').setLabel('Ngưỡng trễ (phút)').setStyle(TextInputStyle.Short).setRequired(false).setValue('15'),
        ),
      );
    await interaction.showModal(modal);
    return true;
  }

  if (customId === 'setup:preset:add:modal') {
    const name          = interaction.fields.getTextInputValue('name').trim();
    const durationRaw   = interaction.fields.getTextInputValue('duration').trim();
    const lateRaw       = interaction.fields.getTextInputValue('late_threshold').trim();
    const duration      = durationRaw ? parseInt(durationRaw, 10) : null;
    const lateThreshold = lateRaw     ? parseInt(lateRaw, 10)     : 15;

    await db.upsertPreset(guild.id, { name, duration_minutes: duration, late_threshold_minutes: lateThreshold });
    await interaction.deferUpdate().catch(() => {});
    const presets = await db.getPresets(guild.id);
    await interaction.editReply(presetMenuComponents(presets));
    return true;
  }

  if (customId.startsWith('setup:preset:edit:')) {
    const presetId = customId.replace('setup:preset:edit:', '');
    const presets  = await db.getPresets(guild.id);
    const preset   = presets.find(p => p.id === presetId);
    if (!preset) {
      await interaction.update({ content: '❌ Không tìm thấy preset.', embeds: [], components: [] });
      return true;
    }
    const modal = new ModalBuilder()
      .setCustomId(`setup:preset:edit:modal:${presetId}`)
      .setTitle(`✏️ Sửa: ${preset.name.slice(0, 35)}`)
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('name').setLabel('Tên preset').setStyle(TextInputStyle.Short).setValue(preset.name).setRequired(true).setMaxLength(80),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('duration').setLabel('Thời lượng (phút)').setStyle(TextInputStyle.Short).setValue(String(preset.duration_minutes ?? '')).setRequired(false),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('late_threshold').setLabel('Ngưỡng trễ (phút)').setStyle(TextInputStyle.Short).setValue(String(preset.late_threshold_minutes ?? 15)).setRequired(false),
        ),
      );
    await interaction.showModal(modal);
    return true;
  }

  if (customId.startsWith('setup:preset:edit:modal:')) {
    const presetId      = customId.replace('setup:preset:edit:modal:', '');
    const name          = interaction.fields.getTextInputValue('name').trim();
    const durationRaw   = interaction.fields.getTextInputValue('duration').trim();
    const lateRaw       = interaction.fields.getTextInputValue('late_threshold').trim();
    const duration      = durationRaw ? parseInt(durationRaw, 10) : null;
    const lateThreshold = lateRaw     ? parseInt(lateRaw, 10)     : 15;

    await db.upsertPreset(guild.id, { id: presetId, name, duration_minutes: duration, late_threshold_minutes: lateThreshold });
    await interaction.deferUpdate().catch(() => {});
    const presets = await db.getPresets(guild.id);
    await interaction.editReply(presetMenuComponents(presets));
    return true;
  }

  if (customId.startsWith('setup:preset:delete:')) {
    const presetId = customId.replace('setup:preset:delete:', '');
    await db.deletePreset(guild.id, presetId);
    await interaction.deferUpdate().catch(() => {});
    const presets = await db.getPresets(guild.id);
    await interaction.editReply(presetMenuComponents(presets));
    return true;
  }

  // Apply preset khi mở phiên
  if (customId.startsWith('setup:preset:apply:')) {
    const presetId = customId.replace('setup:preset:apply:', '');
    const presets  = await db.getPresets(guild.id);
    const preset   = presets.find(p => p.id === presetId);
    if (!preset) {
      await interaction.update({ content: '❌ Không tìm thấy preset.', embeds: [], components: [] });
      return true;
    }
    await interaction.update({ content: null });
    const dash = await buildDashboard(guild);
    await interaction.editReply(dash);
    return true;
  }

  // Nút thêm preset nhanh từ danh sách built-in
  for (const p of PRESETS) {
    if (customId === `setup:preset:builtin:${p.id}`) {
      const { label: moLabel } = ngayThucTe(p.day_of_week, p.open_hour, p.open_minute);
      await db.upsertPreset(guild.id, { name: p.name, duration_minutes: p.duration, late_threshold_minutes: 15 });
      await interaction.deferUpdate().catch(() => {});
      const presets = await db.getPresets(guild.id);
      const msg = presetMenuComponents(presets);
      msg.content = `✅ Đã thêm preset **${p.name}** (Mở: ${moLabel})`;
      await interaction.editReply(msg);
      return true;
    }
  }

  return false;
}

module.exports = { handlePreset };
