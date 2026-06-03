// src/commands/setup/ScheduleView.js
// Render trang quản lý lịch cố định với danh sách + nút thêm/sửa/xoá từng dòng.
'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, ICONS } = require('../../../utils/theme.js');
const { FOOTER_DEFAULT } = require('../../../utils/embeds.js');
const { DAY_NAMES: DAY_VI } = require('../../../utils/format.js');

const CUSTOM_ID = {
  ADD:         'setup:sch:add',
  PAGE_NEXT:   'setup:sch:page:next',
  PAGE_PREV:   'setup:sch:page:prev',
  DEL_PREFIX:  'setup:sch:del:',       // setup:sch:del:<scheduleId>
  DEL_CONFIRM: 'setup:sch:del:yes:',   // setup:sch:del:yes:<scheduleId>
  DEL_CANCEL:  'setup:sch:del:no:',    // setup:sch:del:no:<scheduleId>
  EDIT_PREFIX: 'setup:sch:edit:',      // setup:sch:edit:<scheduleId>
  BACK_HOME:   'setup:home',
};

const PAGE_SIZE = 5;

function fmtSchedule(s) {
  const pc = s.pre_close_minutes ? ` · ⏱️ đóng DD trước ${s.pre_close_minutes}p` : '';
  const ch = s.channel_id ? ` · <#${s.channel_id}>` : '';
  return `**${DAY_VI[s.day_of_week]} ${String(s.hour).padStart(2,'0')}:${String(s.minute).padStart(2,'0')}** — ${s.session_name ?? 'Phiên'}${pc}${ch}`;
}

function render({ schedules, page = 0, guild }) {
  const total = schedules.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const clampedPage = Math.max(0, Math.min(page, totalPages - 1));
  const start = clampedPage * PAGE_SIZE;
  const slice = schedules.slice(start, start + PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`${ICONS.CALENDAR} Lịch cố định — ${guild.name}`)
    .setDescription(
      total === 0
        ? `*Chưa có lịch cố định nào.*\n> Bấm **${ICONS.PLUS} Thêm lịch** để tạo lịch mới.`
        : slice.map((s, i) => `${start + i + 1}. ${fmtSchedule(s)}`).join('\n')
    )
    .setFooter({ text: `${FOOTER_DEFAULT} · Trang ${clampedPage + 1}/${totalPages} · Tổng ${total} lịch` })
    .setTimestamp();

  // Row 1: 5 nút xoá (cho từng lịch trong trang)
  const delRow = new ActionRowBuilder();
  if (total > 0) {
    for (const s of slice) {
      delRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID.DEL_PREFIX}${s.id}`)
          .setLabel(`✕ ${DAY_VI[s.day_of_week]} ${String(s.hour).padStart(2,'0')}:${String(s.minute).padStart(2,'0')}`)
          .setStyle(ButtonStyle.Danger),
      );
    }
  }

  // Row 2: edit (1 lịch 1 nút) + add
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.ADD)
      .setLabel('Thêm lịch')
      .setEmoji(ICONS.PLUS)
      .setStyle(ButtonStyle.Success),
  );
  if (slice.length > 0) {
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`${CUSTOM_ID.EDIT_PREFIX}${slice[0].id}`)
        .setLabel('Sửa lịch đầu')
        .setEmoji(ICONS.EDIT)
        .setStyle(ButtonStyle.Secondary),
    );
  }

  // Row 3: pagination + back
  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.PAGE_PREV)
      .setLabel('◀ Trước')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(clampedPage === 0),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.PAGE_NEXT)
      .setLabel('Sau ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(clampedPage >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.BACK_HOME)
      .setLabel('← Về Bảng điều khiển')
      .setEmoji(ICONS.HOME)
      .setStyle(ButtonStyle.Secondary),
  );

  const components = [];
  if (delRow.components.length > 0) components.push(delRow);
  components.push(actionRow);
  components.push(navRow);

  return { embeds: [embed], components, _page: clampedPage, _totalPages: totalPages };
}

module.exports = { ScheduleView: { render, CUSTOM_ID, PAGE_SIZE } };
