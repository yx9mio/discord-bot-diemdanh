'use strict';
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType } = require('discord.js');
const { COLORS, ICONS } = require('./theme.js');
const { FOOTER_DEFAULT } = require('./embeds.js');

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const CLOSE_DAY_OFFSETS = [
  { label: 'Không tự đóng', value: '-1' },
  { label: 'Cùng ngày', value: '0' },
  { label: 'Hôm sau (+1 ngày)', value: '1' },
  { label: '2 ngày sau (+2)', value: '2' },
  { label: '3 ngày sau (+3)', value: '3' },
  { label: '4 ngày sau (+4)', value: '4' },
  { label: '5 ngày sau (+5)', value: '5' },
  { label: '6 ngày sau (+6)', value: '6' },
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

function renderEditViewStep1(guild, state) {
  const sid = state.scheduleId ? ` · sid:${state.scheduleId}` : '';
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`${ICONS.CALENDAR} Sửa lịch định kỳ — Bước 1/2`)
    .setDescription([
      `Chọn **thứ**, **giờ**, **phút** mở phiên:`,
      '',
      `• Thứ: **${_label(state.day, DAY_LABELS)}**`,
      `• Giờ: **${state.hour != null ? String(state.hour).padStart(2, '0') : '❓'}** : **${state.minute != null ? String(state.minute).padStart(2, '0') : '❓'}**`,
    ].join('\n'))
    .setFooter({ text: `${FOOTER_DEFAULT} · Chọn xong bấm Tiếp theo${sid}` })
    .setTimestamp();

  const dayOpts = DAYS.map(o => new StringSelectMenuOptionBuilder()
    .setLabel(o.label).setValue(o.value).setEmoji(o.emoji)
    .setDefault(String(state.day) === o.value));
  const hourOpts = HOURS.map(h => new StringSelectMenuOptionBuilder()
    .setLabel(String(h).padStart(2, '0')).setValue(String(h))
    .setDefault(state.hour === h));
  const minOpts = MINUTES.map(m => new StringSelectMenuOptionBuilder()
    .setLabel(String(m).padStart(2, '0')).setValue(String(m))
    .setDefault(state.minute === m));

  const daySelect = new StringSelectMenuBuilder()
    .setCustomId('setup:sch:edit:r:day').setPlaceholder('Chọn thứ...')
    .addOptions(dayOpts);
  const hourSelect = new StringSelectMenuBuilder()
    .setCustomId('setup:sch:edit:r:hour').setPlaceholder('Chọn giờ...')
    .addOptions(hourOpts);
  const minSelect = new StringSelectMenuBuilder()
    .setCustomId('setup:sch:edit:r:min').setPlaceholder('Chọn phút...')
    .addOptions(minOpts);

  const row1 = new ActionRowBuilder().addComponents(daySelect);
  const row2 = new ActionRowBuilder().addComponents(hourSelect);
  const row3 = new ActionRowBuilder().addComponents(minSelect);
  const row4 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:sch:edit:r:step1:next').setLabel('Tiếp theo →').setStyle(ButtonStyle.Primary)
      .setDisabled(state.day == null || state.hour == null || state.minute == null),
    new ButtonBuilder().setCustomId('setup:sch:edit:r:step1:cancel').setLabel('Hủy').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2, row3, row4] };
}

function _closeLabel(state) {
  if (state.closeDayOffset == null) return '❓';
  const offset = parseInt(state.closeDayOffset, 10);
  if (offset === -1) return 'Không tự đóng';
  if (state.closeHour == null || state.closeMinute == null) return '❓';
  const closeDay = state.day != null ? (state.day + offset) % 7 : -1;
  const dayName = closeDay >= 0 ? DAY_LABELS[closeDay] : '?';
  return `${dayName} ${String(state.closeHour).padStart(2, '0')}:${String(state.closeMinute).padStart(2, '0')}`;
}

function renderEditViewStep2(guild, state) {
  const sid = state.scheduleId ? ` · sid:${state.scheduleId}` : '';
  const closeStr = _closeLabel(state);
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`${ICONS.CALENDAR} Sửa lịch định kỳ — Bước 2/2`)
    .setDescription([
      `• Thứ: **${_label(state.day, DAY_LABELS)}**`,
      `• Giờ: **${String(state.hour).padStart(2, '0')} : ${String(state.minute).padStart(2, '0')}**`,
      `• Đóng: **${closeStr}**`,
      state.channel ? `• Kênh: <#${state.channel}>` : `• Kênh: **mặc định (cấu hình)**`,
      '',
      'Chọn **ngày kết thúc**, **giờ**, **phút** và **kênh** (tuỳ chọn), sau đó Lưu.',
    ].join('\n'))
    .setFooter({ text: `${FOOTER_DEFAULT}${sid}` })
    .setTimestamp();

  const closeDayOpts = CLOSE_DAY_OFFSETS.map(o => {
    const opt = new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.value);
    if (String(state.closeDayOffset) === o.value) opt.setDefault(true);
    return opt;
  });
  const closeDaySelect = new StringSelectMenuBuilder()
    .setCustomId('setup:sch:edit:r:close_day').setPlaceholder('Chọn ngày kết thúc...')
    .addOptions(closeDayOpts);

  const closeHourOpts = HOURS.map(h => {
    const opt = new StringSelectMenuOptionBuilder().setLabel(String(h).padStart(2, '0')).setValue(String(h));
    if (state.closeHour === h) opt.setDefault(true);
    return opt;
  });
  const closeHourSelect = new StringSelectMenuBuilder()
    .setCustomId('setup:sch:edit:r:close_hour').setPlaceholder('Chọn giờ kết thúc...')
    .addOptions(closeHourOpts);

  const closeMinOpts = MINUTES.map(m => {
    const opt = new StringSelectMenuOptionBuilder().setLabel(String(m).padStart(2, '0')).setValue(String(m));
    if (state.closeMinute === m) opt.setDefault(true);
    return opt;
  });
  const closeMinSelect = new StringSelectMenuBuilder()
    .setCustomId('setup:sch:edit:r:close_min').setPlaceholder('Chọn phút kết thúc...')
    .addOptions(closeMinOpts);

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId('setup:sch:edit:r:channel')
    .setPlaceholder('Chọn kênh thông báo (tuỳ chọn)')
    .setChannelTypes(ChannelType.GuildText);

  const noAutoClose = state.closeDayOffset === '-1';
  const allCloseSet = state.closeDayOffset != null && state.closeHour != null && state.closeMinute != null;
  const canConfirm = noAutoClose || allCloseSet;

  const row1 = new ActionRowBuilder().addComponents(closeDaySelect);
  const row2 = new ActionRowBuilder().addComponents(closeHourSelect);
  const row3 = new ActionRowBuilder().addComponents(closeMinSelect);
  const row4 = new ActionRowBuilder().addComponents(channelSelect);
  const row5 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:sch:edit:r:step2:confirm').setLabel('✅ Lưu thay đổi').setStyle(ButtonStyle.Success)
      .setDisabled(!canConfirm),
    new ButtonBuilder().setCustomId('setup:sch:edit:r:step2:cancel').setLabel('Hủy').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2, row3, row4, row5] };
}

module.exports = { renderEditViewStep1, renderEditViewStep2 };
