// src/commands/setup/_views/_ScheduleView.js
// [REDESIGN] Rewrite: fix import path, xóa pre_close_minutes (cột không tồn tại),
//            dùng close_hour/close_minute thay thế
'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, ICONS } = require('../../../../utils/theme.js');
const { FOOTER_DEFAULT, buildAuthor } = require('../../../../utils/embeds.js');
const { DAY_NAMES: DAY_VI } = require('../../../../utils/format.js');

const CUSTOM_ID = {
  ADD_R:         'setup:sch:add:r',
  ADD_O:         'setup:sch:add:o',
  ADD_R_DAY:     'setup:sch:add:r:day',
  ADD_R_HOUR:    'setup:sch:add:r:hour',
  ADD_R_MIN:     'setup:sch:add:r:min',
  ADD_R_DURATION:'setup:sch:add:r:duration',
  ADD_R_CHANNEL: 'setup:sch:add:r:channel',
  ADD_R_NEXT:    'setup:sch:add:r:step1:next',
  ADD_R_CONFIRM: 'setup:sch:add:r:step2:confirm',
  ADD_R_CANCEL1: 'setup:sch:add:r:step1:cancel',
  ADD_R_CANCEL2: 'setup:sch:add:r:step2:cancel',
  PAGE_NEXT:     'setup:sch:page:next',
  PAGE_PREV:     'setup:sch:page:prev',
  DEL_PREFIX:    'setup:sch:del:',
  DEL_CONFIRM:   'setup:sch:del:yes:',
  DEL_CANCEL:    'setup:sch:del:no:',
  EDIT_PREFIX:   'setup:sch:edit:',
  REFRESH:       'setup:sch:refresh',
  BACK_HOME:     'setup:home',
};

const PAGE_SIZE = 5;

function _fmtSchedule(s) {
  const isOneTime = s.type === 'one_time' || s.scheduled_date;
  const day  = isOneTime ? (s.scheduled_date ?? '?') : (DAY_VI[s.day_of_week] ?? '?');
  const open = `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`;
  const ch   = s.channel_id ? ` · <#${s.channel_id}>` : '';
  const closeStr = (s.close_hour != null && s.close_minute != null)
    ? ` · ⏹ đóng ${String(s.close_hour).padStart(2, '0')}:${String(s.close_minute).padStart(2, '0')}`
    : '';
  const remind = s.reminder_1_min != null ? ` · 🔔 ${s.reminder_1_min}p` : '';
  const label = isOneTime ? `📅 ${day}` : `${day}`;
  return `**${label} ${open}** — ${s.session_name ?? 'Phiên'}${closeStr}${remind}${ch}`;
}

function render({ schedules, page = 0, guild }) {
  const safe      = Array.isArray(schedules) ? schedules : [];
  const total      = safe.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cPage      = Math.max(0, Math.min(page, totalPages - 1));
  const start      = cPage * PAGE_SIZE;
  const slice      = safe.slice(start, start + PAGE_SIZE);

  const desc = total === 0
    ? `*Chưa có lịch cố định nào.*\n> Bấm **+ Thêm hằng tuần** hoặc **+ Thêm một lần** để tạo.`
    : slice.map((s, i) => `${start + i + 1}. ${_fmtSchedule(s)}`).join('\n');

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setAuthor(buildAuthor(guild))
    .setTitle(`${ICONS.CALENDAR} Lịch cố định`)
    .setDescription(desc)
    .setFooter({ text: `${FOOTER_DEFAULT} · Trang ${cPage + 1}/${totalPages} · Tổng ${total} lịch` })
    .setTimestamp();

  const components = [];

  // Nút sửa + xóa — mỗi lịch trong trang hiện tại
  if (slice.length > 0) {
    const editRow = new ActionRowBuilder();
    const delRow = new ActionRowBuilder();
    for (const s of slice) {
      const isOneTime = s.type === 'one_time' || s.scheduled_date;
      const dayLabel = isOneTime ? (s.scheduled_date ?? '?') : (DAY_VI[s.day_of_week] ?? '?');
      const timeLabel = `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`;
      editRow.addComponents(
        new ButtonBuilder().setCustomId(`${CUSTOM_ID.EDIT_PREFIX}${s.id}`).setLabel(`✎ ${dayLabel} ${timeLabel}`).setStyle(ButtonStyle.Secondary),
      );
      delRow.addComponents(
        new ButtonBuilder().setCustomId(`${CUSTOM_ID.DEL_PREFIX}${s.id}`).setLabel(`✕ ${dayLabel} ${timeLabel}`).setStyle(ButtonStyle.Danger),
      );
    }
    components.push(editRow, delRow);
  }

  const ctrlRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.ADD_R).setLabel('+ Hằng tuần').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(CUSTOM_ID.ADD_O).setLabel('+ Một lần').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(CUSTOM_ID.PAGE_PREV).setLabel('◀ Trước').setStyle(ButtonStyle.Secondary).setDisabled(cPage === 0),
    new ButtonBuilder().setCustomId(CUSTOM_ID.PAGE_NEXT).setLabel('Sau ▶').setStyle(ButtonStyle.Secondary).setDisabled(cPage >= totalPages - 1),
  );

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.REFRESH).setLabel('Làm mới').setEmoji(ICONS.REFRESH).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.BACK_HOME).setLabel('← Dashboard').setEmoji(ICONS.HOME).setStyle(ButtonStyle.Secondary),
  );

  components.push(ctrlRow, navRow);
  return { embeds: [embed], components, _page: cPage, _totalPages: totalPages };
}

module.exports = { ScheduleView: { render, CUSTOM_ID, PAGE_SIZE } };
