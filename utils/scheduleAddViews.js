'use strict';
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType } = require('discord.js');
const { COLORS, ICONS } = require('./theme.js');
const { FOOTER_DEFAULT } = require('./embeds.js');

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const DURATIONS = [
  { label: '15 phút', value: '15' },
  { label: '30 phút', value: '30' },
  { label: '45 phút', value: '45' },
  { label: '1 giờ', value: '60' },
  { label: '1 giờ 30', value: '90' },
  { label: '2 giờ', value: '120' },
  { label: 'Không tự đóng', value: '0' },
];
const DAYS = [
  { label: 'Thứ Hai (T2)', value: '1', emoji: '1️⃣' },
  { label: 'Thứ Ba (T3)', value: '2', emoji: '2️⃣' },
  { label: 'Thứ Tư (T4)', value: '3', emoji: '3️⃣' },
  { label: 'Thứ Năm (T5)', value: '4', emoji: '4️⃣' },
  { label: 'Thứ Sáu (T6)', value: '5', emoji: '5️⃣' },
  { label: 'Thứ Bảy (T7)', value: '6', emoji: '6️⃣' },
  { label: 'Chủ Nhật (CN)', value: '0', emoji: '7️⃣' },
];
const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function _label(v, labels) { return v != null ? labels[v] : '❓'; }

function renderAddViewStep1(guild, state) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`${ICONS.CALENDAR} Thêm lịch định kỳ — Bước 1/2`)
    .setDescription([
      `Chọn **thứ**, **giờ**, **phút** mở phiên:`,
      '',
      `• Thứ: **${_label(state.day, DAY_LABELS)}**`,
      `• Giờ: **${state.hour != null ? String(state.hour).padStart(2, '0') : '❓'}** : **${state.minute != null ? String(state.minute).padStart(2, '0') : '❓'}**`,
    ].join('\n'))
    .setFooter({ text: `${FOOTER_DEFAULT} · Chọn xong bấm Tiếp theo` })
    .setTimestamp();

  const dayOpts = DAYS.map(o => new StringSelectMenuOptionBuilder()
    .setLabel(o.label).setValue(o.value).setEmoji(o.emoji));
  const hourOpts = HOURS.map(h => new StringSelectMenuOptionBuilder()
    .setLabel(String(h).padStart(2, '0')).setValue(String(h)));
  const minOpts = MINUTES.map(m => new StringSelectMenuOptionBuilder()
    .setLabel(String(m).padStart(2, '0')).setValue(String(m)));

  const daySelect = new StringSelectMenuBuilder()
    .setCustomId('setup:sch:add:r:day').setPlaceholder('Chọn thứ...')
    .addOptions(dayOpts);
  const hourSelect = new StringSelectMenuBuilder()
    .setCustomId('setup:sch:add:r:hour').setPlaceholder('Chọn giờ...')
    .addOptions(hourOpts);
  const minSelect = new StringSelectMenuBuilder()
    .setCustomId('setup:sch:add:r:min').setPlaceholder('Chọn phút...')
    .addOptions(minOpts);

  const row1 = new ActionRowBuilder().addComponents(daySelect);
  const row2 = new ActionRowBuilder().addComponents(hourSelect);
  const row3 = new ActionRowBuilder().addComponents(minSelect);
  const row4 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:sch:add:r:step1:next').setLabel('Tiếp theo →').setStyle(ButtonStyle.Primary)
      .setDisabled(state.day == null || state.hour == null || state.minute == null),
    new ButtonBuilder().setCustomId('setup:sch:add:r:step1:cancel').setLabel('Hủy').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2, row3, row4] };
}

function renderAddViewStep2(guild, state) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`${ICONS.CALENDAR} Thêm lịch định kỳ — Bước 2/2`)
    .setDescription([
      `• Thứ: **${_label(state.day, DAY_LABELS)}**`,
      `• Giờ: **${String(state.hour).padStart(2, '0')} : ${String(state.minute).padStart(2, '0')}**`,
      `• Thời lượng: **${state.duration != null ? (state.duration === 0 ? 'Không tự đóng' : state.duration + ' phút') : '❓'}**`,
      state.channel ? `• Kênh: <#${state.channel}>` : `• Kênh: **mặc định (cấu hình)**`,
      '',
      'Chọn **thời lượng** và **kênh thông báo** (tuỳ chọn), sau đó Xác nhận.',
    ].join('\n'))
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  const durOpts = DURATIONS.map(o => new StringSelectMenuOptionBuilder()
    .setLabel(o.label).setValue(o.value));
  const durSelect = new StringSelectMenuBuilder()
    .setCustomId('setup:sch:add:r:duration').setPlaceholder('Chọn thời lượng...')
    .addOptions(durOpts);

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId('setup:sch:add:r:channel')
    .setPlaceholder('Chọn kênh thông báo (tuỳ chọn)')
    .setChannelTypes(ChannelType.GuildText);
  // Row 1: Duration
  const row1 = new ActionRowBuilder().addComponents(durSelect);
  // Row 2: Channel
  const row2 = new ActionRowBuilder().addComponents(channelSelect);
  // Row 3: Confirm / Cancel / Back
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:sch:add:r:step2:confirm').setLabel('✅ Xác nhận').setStyle(ButtonStyle.Success)
      .setDisabled(state.duration == null),
    new ButtonBuilder().setCustomId('setup:sch:add:r:step2:cancel').setLabel('Hủy').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2, row3] };
}

module.exports = { renderAddViewStep1, renderAddViewStep2, DAYS, HOURS, MINUTES, DURATIONS };
